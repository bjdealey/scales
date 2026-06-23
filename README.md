# Scales

Assemble small building blocks into a working Python program, and run it — no syntax knowledge required.

## What it does

Scales is a low-code front-end for Python. Instead of writing code by hand, you build programs by connecting blocks — each block represents something your program should do, like making an HTTP request, looping over a list, or printing a value. As you build, Scales generates real Python in a live preview panel and lets you run it directly from the browser.

Variables are managed in a dedicated panel where you set names, types, and values through purpose-built inputs — no quotes, brackets, or Python syntax needed.

## Prerequisites

- [Node.js](https://nodejs.org) (v18 or later)
- Python 3.9 or later

## Setup

**Frontend**

```bash
cd frontend
npm install
```

**Backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Running

Start both the frontend and backend. Open two terminal tabs from the project root.

**Frontend** (runs on http://localhost:5173)

```bash
cd frontend
npm run dev
```

**Backend** (runs on http://localhost:8000)

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

Then open http://localhost:5173 in your browser.

## How it works

Each block is a small piece of a Python program. Arrange them on the canvas, set your variables in the panel on the left, and the generated code updates live on the right. Hit **Run** to execute it.
