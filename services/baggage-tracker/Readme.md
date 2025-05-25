## Baggage Tracker Service

### Overview
Tracks baggage ETA via CV pipeline with QR and beacon fallback.

### Structure
```
baggage-tracker/
├── app.py
├── cv/
│   ├── pipeline.py
│   ├── depth\_filter.py
│   └── utils.py
├── fallback/
│   ├── qr\_fallback.py
│   └── beacon\_fallback.py
├── services/
│   └── eta\_service.py
├── models/
│   ├── eta\_request.py
│   └── eta\_response.py
├── tests/
│   ├── test\_pipeline.py
│   ├── test\_fallback.py
│   └── test\_endpoints.py
├── requirements.txt
└── Dockerfile
```
