# CFTree



## Project Structure

```
CFTree/
├── incomeCFs.ipynb       # Jupyter notebook for generating counterfactuals
├── cf-buiding/           # React frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── assets/       # Images and static assets
│   │   └── ...
│   ├── public/
│   │   └── data/         
│   └── package.json
├── fastAPIbackend/       # Python FastAPI backend
│   ├── app/
│   │   ├── main.py       # Main API endpoints
│   │   ├── tree_builder.py
│   │   └── cluster_builder.py
│   ├── data/             # Pickle data files
│   └── run.py
├── requirements.txt      # Python dependencies
└── README.md
```


## Prerequisites

- **Node.js** (v14 or higher)
- **Python** (v3.7 or higher)
- **npm** or **yarn**

## Installation & Setup

### Frontend (React Application)

1. Navigate to the frontend directory:
   ```bash
   cd cf-buiding
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

   The application will open at `http://localhost:3000`

### Backend (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd fastAPIbackend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```


## Data Generation

The `incomeCFs.ipynb` notebook is provided to generate the counterfactual explanation data (`.pkl` files) used by the backend.

**Note**: The repository already includes pre-generated data in the `fastAPIbackend/data/` directory, so running this notebook is optional. You would only need to run it if you want to regenerate the data or experiment with different dataset parameters.



## Usage

**Start both servers**: Make sure both the React frontend (port 3000) and FastAPI backend (port 8000) are running
The application will open at `http://localhost:3000`

## Data

The project can work with several datasets:
- **Income Dataset**: Adult income prediction data


Data files are stored in pickle format in the `fastAPIbackend/data/` directory.

For further instructions on how to add a new dataset, please refer to the [`how_to_add_a_new_dataset.pdf`](how_to_add_a_new_dataset.pdf) file.

## License

This project is licensed under the terms specified in the LICENSE file.


## Contact

For questions or support, please create an issue in the repository.
