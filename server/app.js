require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const alasql = require('alasql');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- In-Memory Logging System ---
const MAX_LOGS = 50;
const serverLogs = [];

function addLog(type, message, details = null) {
    const logEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        type: type.toUpperCase(),
        message,
        details
    };
    serverLogs.unshift(logEntry);
    if (serverLogs.length > MAX_LOGS) serverLogs.pop();
    console.log(`[${logEntry.type}] ${logEntry.message}`);
}

app.get('/', (req, res) => {
    res.send('TradeXchange API is running 🚀');
});

// Log Endpoint
app.get('/api/logs', (req, res) => {
    res.json(serverLogs);
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Caching & Data Cleaning Strategy ---
let cachedData = null;
let lastFetchTime = 0;
let latestDataYear = 2023; // Default fallback, will be updated by data
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function parseLpiScore(value) {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const str = String(value).trim().toLowerCase();
    if (str === 'three point six') return 3.6;
    const floatVal = parseFloat(str);
    return isNaN(floatVal) ? null : floatVal;
}

function toTitleCase(str) {
    if (!str) return 'Unknown';
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

async function getCleanData() {
    const now = Date.now();
    if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
        addLog('CACHE', 'Serving data from cache');
        return cachedData;
    }

    addLog('DB', 'Fetching fresh data from Supabase...');
    const { data: rawData, error } = await supabase
        .from('countries_lpi')
        .select('*');

    if (error) {
        addLog('ERROR', `Supabase error: ${error.message}`);
        throw new Error(`Supabase error: ${error.message}`);
    }
    if (!rawData) return [];

    let tempMaxYear = 0;

    const cleanData = rawData
        .map(item => {
            const year = item.year ? parseInt(item.year) : 0;
            // Track max year dynamically
            if (year > tempMaxYear) tempMaxYear = year;

            return {
                ...item,
                country: toTitleCase(item.country),
                region: toTitleCase(item.region),
                lpi_score: parseLpiScore(item.lpi_score),
                year: year
            };
        })
        .filter(item => item.lpi_score !== null);

    // Update global max year
    if (tempMaxYear > 0) {
        latestDataYear = tempMaxYear;
        addLog('SYSTEM', `Detected latest data year from DB: ${latestDataYear}`);
    }

    cachedData = cleanData;
    lastFetchTime = now;
    addLog('DATA', `Data prepared. Rows: ${cleanData.length}. Latest Year: ${latestDataYear}`);

    return cleanData;
}

// Generate System Prompt Dynamically
const generateSystemPrompt = (latestYear) => `
You are a SQL expert.
The table name is 'countries_lpi' with columns:
- id (int)
- country (text)
- region (text)
- lpi_score (float)
- year (int) (Available years: e.g. 2014, 2016, 2018, ${latestYear})

Given a natural language question, generate a valid SQL query to answer it.
Return ONLY the SQL query. Do not include markdown formatting like \`\`\`sql.
Do not include explanations.

IMPORTANT: DATE/TIME LOGIC
1. IF the user specified a year (e.g. "in 2018"), ADD \`WHERE year = 2018\`.
2. IF the user did NOT specify a year, YOU MUST DEFAULT TO THE LATEST DATA (${latestYear}).
   - Use \`WHERE year = ${latestYear}\` automatically.
   - This prevents duplicate country entries from appearing in the results.
   - Example: "Top 5 countries" -> SELECT ... WHERE year = ${latestYear} ORDER BY lpi_score DESC ...

Specific instructions replacement:
- Use standard SQL syntax compatible with SQLite/Alasql.
- Use ILIKE or LOWER(col) LIKE LOWER(...) for case-insensitive string matching.
- "Asia" should match '%Asia%'.
- "average" implies AVG().
- "logistics performance" refers to 'lpi_score'.
`;

app.post('/api/ask', async (req, res) => {
    try {
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        addLog('QUERY', `Received question: "${question}"`);

        // 1. Ensure we have data (and thus the latest year) BEFORE generating SQL
        // We fetch data first now to get the 'latestDataYear' for the prompt
        const countriesData = await getCleanData();

        if (countriesData.length === 0) {
            addLog('WARN', 'No valid data found in DB');
            return res.json({ answer: [], sql: "", message: "No valid data found in database." });
        }

        // 2. Generate Prompt with the detected Year
        const dynamicPrompt = generateSystemPrompt(latestDataYear);

        // 3. Call LLM
        const llmResponse = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    { role: 'system', content: dynamicPrompt },
                    { role: 'user', content: question }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'TradeXchange AI Demo'
                }
            }
        );

        let sqlQuery = llmResponse.data.choices[0].message.content;
        sqlQuery = sqlQuery.replace(/```sql/g, '').replace(/```/g, '').trim();

        addLog('LLM', `Generated SQL (Default Year: ${latestDataYear})`, sqlQuery);

        // 4. Execute SQL
        alasql.fn.ilike = function (a, b) {
            return (a || "").toLowerCase().indexOf((b || "").toLowerCase().replace(/%/g, '')) >= 0;
        }

        const runnableSql = sqlQuery.replace(/countries_lpi/gi, '?');

        addLog('EXEC', `Executing SQL...`);
        const result = alasql(runnableSql, [countriesData]);

        addLog('RESULT', `Returned ${result.length} rows`);

        res.json({
            answer: result,
            sql: sqlQuery
        });

    } catch (error) {
        addLog('ERROR', 'Internal Server Error', error.message);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    addLog('SYSTEM', `Server started on port ${port}`);
});
