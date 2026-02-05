# TradeXchange AI

A natural language interface for querying global trade logistics performance data (LPI). This project allows users to ask questions, which are converted into SQL queries by an AI model and executed against the dataset to produce tabular results.

## 🚀 Features

- **Natural Language to SQL**: Powered by **Google Gemini 2.0 Flash** via OpenRouter.
- **Dynamic Data Querying**: Retrieves data from a Supabase PostgreSQL database.
- **Friendly UI**: Modern, dark-mode interface built with React.
- **Transparent Execution**: Displays both the generated SQL and the results for verification.

## 📺 Demo

<!-- Paste your Loom/YouTube link below -->
[Link to Demo Video](PLACEHOLDER)

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Vanilla CSS
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **AI/LLM**: OpenRouter API (Google Gemini 2.0 Flash)
- **SQL Processing**: Alasql (In-memory SQL execution for read-only data adaptation)

## 🏗️ Architecture Note

Due to the provided Supabase connection being read-only and restricted to PostgREST (without direct SQL execution capabilities via the network), this project implements a **Hybrid Execution Model**:
1. The Backend fetches the `countries_lpi` dataset from Supabase using the standard client.
2. The LLM generates standard SQL based on the user's question.
3. The SQL is executed essentially "in-memory" against the fetched data using **Alasql**.
This ensures that "Show me top 5..." or "Average by region..." queries work correctly even without direct raw SQL access to the DB engine.

## 📦 Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- npm

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd demo
```

### 2. Backend Setup
Navigate to the server directory and install dependencies:
```bash
cd server
npm install
```

Create a `.env` file in the `server` directory with the following credentials:
```env
SUPABASE_URL=https://bqyrjnpwiwldppbkeafk.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeXJqbnB3aXdsZHBwYmtlYWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzI0MDcsImV4cCI6MjA4NTgwODQwN30.JmzMN1xU_yhGzW4Ki_d6PpJqkTpVjDHA7dkyen4w6Rg
OPENROUTER_API_KEY=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
PORT=3000
```
> **Note**: In a production environment, API keys should not be committed to the repository. They are included here only for the ease of this assessment demo.

Start the backend server:
```bash
node app.js
```
The server will run on `http://localhost:3000`.

### 3. Frontend Setup
Open a new terminal, navigate to the client directory, and install dependencies:
```bash
cd client
npm install
```

Start the frontend development server:
```bash
npm run dev
```
The application will open at `http://localhost:5173` (or similar port).

## ✅ Verified Queries

The system has been verified to handle the following requirements:
1. **"Which countries in Asia have an LPI score above 3.0?"**
2. **"What's the average LPI score by region?"**
3. **"Show me the top 5 countries by logistics performance"**

## 🧠 System Logic & Data Handling

### 1. Data Cleaning & Normalization
The system implements a robust preprocessing layer before any SQL is executed:
- **Normalization**: All Country and Region names are converted to **Title Case** (e.g., "singapore" -> "Singapore") to ensure consistent matching.
- **Data Repair**: Handles "dirty" data such as text-based numbers (e.g., converts "three point six" to `3.6`).
- **Validation**: Automatically filters out rows with `NULL` or invalid LPI scores to prevents calculation errors.

### 2. Smart Year Logic (Defaulting)
To handle historical data correctly without user complexity:
- **Default Behavior**: If the user's question **does not specify a year** (e.g., "Top 5 countries"), the system automatically filters for the **latest sensible year** (e.g., 2023). This ensures results are current and prevents duplicate country entries from different years appearing in the list.
- **Specific Time**: Users can still ask for historical data by explicitly mentioning it (e.g., "Show me the top 5 from 2018"), and the system will respect that constraint.

### 3. Execution Pipeline
1. **Fetch**: Raw, potentially "dirty" data is fetched from Supabase.
2. **Clean**: Data passes through the cleaning layer (Normalization + Repair).
3. **Generate**: LLM converts the natural language question into SQL, injected with specific rules for the cleaned data.
4. **Execute**: The generated SQL is run against the *clean* in-memory dataset using Alasql.


