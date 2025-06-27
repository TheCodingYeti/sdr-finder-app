import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [excelData, setExcelData] = useState([]); // Stores parsed Excel data
  const [searchTerm, setSearchTerm] = useState(''); // Stores the current search term for Sales Level 6
  const [filteredResults, setFilteredResults] = useState([]); // Stores results filtered by search term
  const [message, setMessage] = useState('Loading Excel parsing library...'); // Displays user messages
  const [fileSelected, setFileSelected] = useState(false); // Tracks if a file has been selected
  const [isXLSXLoaded, setIsXLSXLoaded] = useState(false); // Tracks if XLSX library is loaded
  const fileInputRef = useRef(null); // Ref for the file input element to programmatically click it

  /**
   * Dynamically loads the SheetJS (xlsx) library from a CDN.
   * This ensures the library is available in the browser even if direct npm imports fail
   * in certain environments.
   */
  useEffect(() => {
    // Check if XLSX is already globally available (e.g., from a previous load or if it somehow resolves)
    if (typeof window.XLSX !== 'undefined') {
      setIsXLSXLoaded(true);
      setMessage('Upload an Excel or CSV file to get started.');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => {
      setIsXLSXLoaded(true);
      setMessage('Upload an Excel or CSV file to get started.');
      console.log("XLSX library loaded dynamically.");
    };
    script.onerror = () => {
      console.error("Failed to load XLSX library dynamically.");
      setMessage("Failed to load Excel parsing library. Please check your internet connection and try refreshing.");
    };
    document.head.appendChild(script);

    // Cleanup script on component unmount
    return () => {
      const existingScript = document.querySelector('script[src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount

  /**
   * Handles the file upload (Excel or CSV).
   * Reads the file, parses it using the globally available XLSX object, and updates the state.
   * Differentiates between CSV and Excel for reading method.
   * @param {Event} event The change event from the file input.
   */
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setFileSelected(false);
      setMessage('Please select an Excel or CSV file to upload.');
      setExcelData([]);
      setFilteredResults([]);
      return;
    }

    if (!isXLSXLoaded) {
      setMessage('Excel parsing library is still loading. Please wait a moment and try again.');
      // Reset file input to allow re-selection after library loads
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setFileSelected(true); // Indicate that a file has been selected
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let workbook;
        // Check file extension to determine how to parse
        if (file.name.toLowerCase().endsWith('.csv')) {
          const csvString = e.target.result;
          // SheetJS can read CSV from a string directly
          workbook = window.XLSX.read(csvString, { type: 'string' });
        } else {
          // For XLSX/XLS, read as array buffer
          const data = new Uint8Array(e.target.result);
          workbook = window.XLSX.read(data, { type: 'array' });
        }

        const sheetName = workbook.SheetNames[0]; // Get the first sheet
        const worksheet = workbook.Sheets[sheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet); // Convert sheet to JSON

        // Assuming file has columns named "Sales Level 6" and "SDR Name"
        // We'll clean up keys to be consistent and ensure required fields exist
        const processedData = json.map(row => {
          const newRow = {};
          for (const key in row) {
            const cleanedKey = String(key).trim().toLowerCase(); // Ensure key is a string before trimming
            if (cleanedKey.includes('sales level 6')) {
              newRow['salesLevel6'] = row[key];
            } else if (cleanedKey.includes('sdr')) { // Catch "SDR Name", "SDR", etc.
              newRow['sdrName'] = row[key];
            } else {
              newRow[cleanedKey] = row[key]; // Keep other columns as-is
            }
          }
          return newRow;
        }).filter(row => row.salesLevel6 && row.sdrName); // Only include rows with both fields

        if (processedData.length > 0) {
          setMessage(`Successfully loaded ${processedData.length} records from "${file.name}". You can now search.`);
          setExcelData(processedData);
          setFilteredResults([]); // Clear previous search results on new upload
        } else {
          setExcelData([]);
          setMessage('No valid "Sales Level 6" or "SDR Name" data found in the file. Please ensure these columns exist.');
          if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Clear the file input visually if data is invalid
          }
        }
      } catch (error) {
        console.error("Error reading file:", error);
        setMessage('Failed to read file. Please ensure it is a valid .xlsx, .xls, or .csv file.');
        setExcelData([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Clear the file input visually on error
        }
      }
    };

    // Read file based on its type
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file); // Read CSV as text
    } else {
      reader.readAsArrayBuffer(file); // Read Excel files as array buffer
    }
  };

  /**
   * Handles changes in the search input field.
   * Filters results to show only one SDR per unique Sales Level 6.
   * @param {Event} event The change event from the input.
   */
  const handleSearchChange = (event) => {
    const term = event.target.value;
    setSearchTerm(term);

    if (term.length > 0 && excelData.length > 0) {
      // Use a Map to store unique Sales Level 6 -> SDR mappings.
      // This ensures that for each salesLevel6, only the first encountered SDR is kept.
      const uniqueResultsMap = new Map();

      excelData.forEach(row => {
        if (row.salesLevel6 && String(row.salesLevel6).toLowerCase().includes(term.toLowerCase())) {
          const salesLevel6Key = String(row.salesLevel6).toLowerCase();
          // If this Sales Level 6 hasn't been added to the map yet, add it.
          // This ensures we only get one SDR per Sales Level 6.
          if (!uniqueResultsMap.has(salesLevel6Key)) {
            uniqueResultsMap.set(salesLevel6Key, {
              salesLevel6: row.salesLevel6, // Keep original casing for display
              sdrName: row.sdrName
            });
          }
        }
      });

      // Convert the map values (unique SDR assignments) to an array for rendering.
      const results = Array.from(uniqueResultsMap.values());

      setFilteredResults(results);

      if (results.length === 0) {
        setMessage('No matching Sales Level 6 found.');
      } else {
        setMessage(''); // Clear message if results are found
      }
    } else {
      setFilteredResults([]);
      if (excelData.length > 0) {
        setMessage('Start typing in the search bar to find SDRs by Sales Level 6.');
      } else if (term.length > 0) {
        setMessage('Please upload a file first to search.');
      } else {
        setMessage(''); // Clear message if search term is empty and no data uploaded
      }
    }
  };

  /**
   * Clears the search term and results.
   */
  const clearSearch = () => {
    setSearchTerm('');
    setFilteredResults([]);
    if (excelData.length > 0) {
      setMessage('Search cleared. You can now enter a new Sales Level 6 to find.');
    } else {
      setMessage('Upload an Excel or CSV file to get started.');
    }
  };

  /**
   * Clears all data and resets the app to its initial state.
   */
  const resetApp = () => {
    setExcelData([]);
    setSearchTerm('');
    setFilteredResults([]);
    setMessage('App reset. Upload an Excel or CSV file to get started.');
    setFileSelected(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear the file input visually
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-inter text-gray-800 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10 w-full max-w-2xl flex flex-col items-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-indigo-700 mb-6 text-center">SDR Finder</h1>
        <p className="text-gray-600 mb-8 text-center max-w-md">
          Upload your Excel or CSV sheet to quickly find the assigned SDR based on Sales Level 6 (territory).
        </p>

        {/* File Upload Section */}
        <div className="w-full flex flex-col items-center mb-6">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            ref={fileInputRef} // Attach ref to input
            className="hidden" // Hide the default input
            id="excel-upload"
            disabled={!isXLSXLoaded} // Disable if library not loaded
          />
          <label
            htmlFor="excel-upload"
            className={`cursor-pointer font-semibold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform flex items-center space-x-2 ${
              isXLSXLoaded
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            {isXLSXLoaded ? (
              fileSelected ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>File Selected! Click to Change</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>Upload File (.xlsx, .xls, .csv)</span>
                </>
              )
            ) : (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading Library...</span>
              </>
            )}
          </label>
        </div>

        {/* Message Display */}
        {message && (
          <p className={`mb-6 text-sm text-center px-4 py-2 rounded-lg ${
            message.includes('Successfully loaded') ? 'bg-green-100 text-green-700' :
            message.includes('Loading') ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </p>
        )}

        {/* Search Bar */}
        {excelData.length > 0 && (
          <div className="w-full flex items-center border border-gray-300 rounded-full focus-within:ring-2 focus-within:ring-indigo-400 mb-6 transition duration-200 ease-in-out">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by Sales Level 6..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="flex-grow p-3 rounded-full outline-none bg-transparent"
              aria-label="Search Sales Level 6"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="mr-3 p-1 rounded-full text-gray-500 hover:bg-gray-100 transition duration-200"
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Search Results Display */}
        {filteredResults.length > 0 && (
          <div className="w-full bg-indigo-50 rounded-lg p-4 shadow-inner">
            <h2 className="text-xl font-semibold text-indigo-600 mb-4">Matching SDRs:</h2>
            <ul className="space-y-3">
              {filteredResults.map((result, index) => (
                <li key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg shadow-sm border border-indigo-200">
                  <div className="font-medium text-gray-900">
                    <span className="font-bold">Sales Level 6:</span> {result.salesLevel6}
                  </div>
                  <div className="text-indigo-600 sm:text-lg mt-1 sm:mt-0">
                    <span className="font-bold">SDR:</span> {result.sdrName}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reset Button */}
        {(excelData.length > 0 || fileSelected) && (
          <button
            onClick={resetApp}
            className="mt-8 bg-red-500 text-white font-semibold py-2 px-5 rounded-full shadow-md hover:bg-red-600 transition duration-300 ease-in-out"
          >
            Reset App
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
