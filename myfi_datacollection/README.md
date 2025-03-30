# MyFi Data Collection

MyFi Data Collection is a suite of Python scripts and tools designed to scrape, enrich, and process science fiction book data from various online sources. These tools are an essential part of the MyFi ecosystem, bridging raw data collection with downstream analysis, recommendations, and integration into our backend systems.

---

## Overview

The MyFi Data Collection repository includes modules to:

• Scrape book lists and metadata from websites (such as SciFi Lists pages) using Selenium and BeautifulSoup.  
• Enrich scraped book data by querying the OpenLibrary API and applying data normalization, matching, and fallback strategies to retrieve ISBNs and additional details.  
• Integrate external datasets (e.g., from The StoryGraph) by scraping their HTML pages or processing CSV data for further enrichment.  
• Collect and process user ratings and review data from The StoryGraph, storing progress and aggregated stats in MongoDB.
• Automate interactions on The StoryGraph (using Selenium) by logging in, applying filters, and extracting relevant book rating information.

This robust data collection pipeline ensures that our backend recommendation system and frontend interfaces have access to high-quality, enriched book data.

---

## Technology Stack

- **Python 3.7+**: Primary programming language for scripting and data processing.
- **Requests & BeautifulSoup**: For HTTP requests and HTML parsing.
- **Selenium WebDriver**: For dynamic page scraping and browser automation (with ChromeDriver via webdriver_manager).
- **Pandas & CSV**: For manipulating and storing CSV-based data.
- **Regular Expressions**: For text normalization and data matching.
- **MongoDB & PyMongo**: To store scraping progress, ratings, and book metadata.
- **argparse & tqdm**: For command-line interfaces and progress display.
- **Time & Random**: To control rate limiting and mimic human-like delays during scraping.

---

## Modules & Key Components

### 1. Sci-Fi Books Scraper (Selenium-based)
- **Purpose:** Navigate multiple SciFi Lists pages, extract table rows containing book titles and authors, and output collected data as a CSV.
- **Highlights:**  
  • Utilizes headless Chrome with Selenium, including custom user-agent strings and cooldown periods.  
  • Applies BeautifulSoup for fine-grained HTML parsing and data extraction.
- **Output:** A CSV file (e.g., `scifi_books.csv`) with raw book records.

### 2. OpenLibrary Data Enrichment
- **Purpose:** Enrich scraped CSV data by querying OpenLibrary to fetch additional metadata and ISBNs.
- **Highlights:**  
  • Implements fallback strategies across different API endpoints and HTML scraping.  
  • Uses text normalization and fuzzy matching (SequenceMatcher) to ensure accurate title and author matches.
  • Saves enriched data to a new CSV file (e.g., `scifi_list_OL.csv`).
  
### 3. The StoryGraph Data Processor
- **Purpose:** Retrieve and process book details from The StoryGraph by scraping search results and book pages.
- **Highlights:**  
  • Uses requests and BeautifulSoup to scrape The StoryGraph search pages, extracting titles, authors, and unique StoryGraph IDs.  
  • Updates a CSV with fields like `OL_title`, `OL_library`, and `OL_ID` for further processing.

### 4. The StoryGraph Ratings Scraper (MongoDB-Integrated)
- **Purpose:** Scrape user ratings and review data for individual books from The StoryGraph, and store progress and stats in MongoDB.
- **Highlights:**  
  • Manages pagination, preserving progress per book, and enforcing rate limits to comply with server-side restrictions.  
  • Saves user ratings, updates book rating statistics, and outputs recommendation system metrics.
  • Uses PyMongo to connect and store data in MongoDB collections with indexes for fast queries.

### 5. StoryGraph Selenium Automation
- **Purpose:** Automate logging in to The StoryGraph, navigating to pages of interest, applying filters (e.g., Science Fiction genre), and extracting book rating information.
- **Highlights:**  
  • Implements robust techniques with multiple click and form submission methods.  
  • Provides debugging options (including screenshot capture) for troubleshooting automation issues.
  
---

## Installation

### Prerequisites

• Python 3.7+  
• MongoDB instance (local or Atlas)  
• Google Chrome installed  
• pip package manager

### Setup

1. Clone the repository:  
   git clone [REPOSITORY_URL]
   cd myfi_datacollection

2. Install Python dependencies:  
   pip install -r requirements.txt

   *A sample `requirements.txt` might include:*
   - requests
   - beautifulsoup4
   - pandas
   - selenium
   - webdriver_manager
   - pymongo
   - tqdm

3. (Optional) Configure MongoDB connection details in your scripts if you plan to use the MongoDB-integrated modules.

---

## Usage

Each module includes its own command-line interface with helpful arguments. Here’s a brief overview:

### Sci-Fi Books Scraper

Run the Selenium scraper to extract book data:
   python scrape_with_selenium.py

The script navigates through the SciFi lists, scrapes book details, validates them, and saves the output as `scifi_books.csv`.

### OpenLibrary Enrichment

Process and enrich books from a CSV:
   python process_books.py

This script reads `scifi_books.csv`, enriches the data with ISBN information from OpenLibrary, and outputs `scifi_list_OL.csv`.

### The StoryGraph Data Processor

Extract StoryGraph data for each book:
   python storygraph_processor.py

This script reads your enriched CSV, queries The StoryGraph for additional book details, and updates the CSV accordingly.

### StoryGraph Ratings Scraper

Scrape user ratings from The StoryGraph and store progress in MongoDB:
   python storygraph_ratings.py --batch --books-per-day 20 --delay 120

Use additional flags for listing available books (`--list`), showing stats (`--stats`), or processing a specific book (`--book <OL_ID>`).

### StoryGraph Selenium Automation

Automate StoryGraph login and filtering:
   python storygraph_selenium.py -u your_username -p your_password --debug

Run this script to log in, select "Science Fiction" from available filters, and extract rating information from your StoryGraph account. Use `--no-headless` for visible browser mode during debugging.