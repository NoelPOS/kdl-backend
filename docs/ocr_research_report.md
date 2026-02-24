# Research Report: Manual Paper-based Data Extraction Methods

## 1. Overview
The goal of this research was to find a robust, accurate solution for converting our manual, paper-based student registration forms into structured data for our system database. Achieving reliable Optical Character Recognition (OCR) combined with Information Extraction is notoriously difficult when forms contain mixed languages (Thai and English), uncontrolled handwriting, crossed-out corrections, and varied tabular layouts. 

We systematically explored several Machine Learning / OCR avenues. This document outlines the distinct methods we tried, their pros and cons, why some failed, and the reasoning behind our final chosen architecture.

---

## 2. Explored Methods

### Method 1: AWS Textract
AWS Textract is a fully managed machine learning service designed to extract text, handwriting, and data from scanned documents natively handling forms and tables.

*   **Pros:** Highly scalable AWS-native service. Offers distinct endpoints for analyzing forms (Key-Value pair extraction) and tabular data.
*   **Cons:** We experienced frequent poor extraction results for our specific use cases. It struggled significantly with distinguishing and correctly associating Thai and English handwriting, leading to improperly mapped fields. Its recognition of cursive or messy handwriting was also consistently too low to be reliable.
*   **Why it didn't work:** Due to unpredictable layout orientations and challenging handwriting variations on the registration forms, the key-value extraction failed to produce structured data consistently. We decided to abandon it early on in favor of more specialized tools.

### Method 2: Google Document AI (Form Parser)
We implemented a dedicated pipeline (`ocr-ingest-documentai.ts`) leaning on Google Cloud's Document AI using their specific Form Parser model. 

*   **Pros:** 
    *   Purpose-built for parsing forms with native entity detection.
    *   Supported `languageHints: ['th', 'en']` to guide the OCR engine.
    *   Provides high-confidence spatial understanding (bounding boxes).
*   **Cons:** 
    *   **High Setup Complexity:** Required Google Cloud project configuration, Service Account JSON credential files, and deploying dedicated processor endpoints (`GOOGLE_PROCESSOR_ID`).
    *   **Text Corruption & Handwriting Failure:** Document AI consistently suffered from the "corrupted Thai" phenomenon, mistakenly rendering Thai script as Latin characters with diacritics (e.g., "ňáíúŕťýůíóńěšďřťž"). Furthermore, its general accuracy on highly variable or cursive handwriting (especially Thai handwriting) regularly failed.
    *   **Incomplete Extraction:** Finding specific sub-data (like extracting the exact Course Name from a messy table header) was heavily error-prone.
*   **Why it didn't work:** The raw OCR was not reliable enough on its own. We ultimately had to inject costly, secondary LLM API calls (we tried Gemini 2.0 Flash, Claude 3 Haiku, and GPT-4o-mini via fallback logic) just to clean up the corrupted Thai text and accurately extract the course names. This completely defeated the purpose of a standalone optical parser and made the architecture unnecessarily complex and expensive.

### Method 3: Local OCR Engine (PaddleOCR / Peta OCR)
We wrote a local Python script (`ocr-service/main.py`) paired with a Node.js wrapper (`ocr-ingest.ts`) to run PaddleOCR locally against the images. The images had to be pre-processed from HEIC to JPG format first.

*   **Pros:** 
    *   **Completely Free & Fast:** No API limits, no external cloud costs, and fast inference time per image.
    *   Local privacy guarantees since data never leaves the server.
*   **Cons:** 
    *   **Zero Spatial Awareness:** Local OCR largely outputs a flat dictionary/string of raw text blocks read from top-left to bottom-right.
    *   **Brittle Parsing Logic:** Because the result was flat text, we had to rely on complex Regular Expressions (regex) to extract fields (e.g., scanning for `/Student ID[:\s]+(\d+)/i` or finding a line starting with `Course`). 
    *   **Poor Handwriting Quality:** Often hallucinated or failed entirely when faced with handwritten values compared to printed form labels.
*   **Why it didn't work:** If a user forgot to write a colon (`:`), or if the OCR misread standard keywords, the regex completely broke. It failed to capture names if they spanned multiple lines or if tabular column alignments varied even slightly from the norm. Coupled with bad handwriting recognition, this solution was unreliable in production.

---

## 3. Final Result: Gemini Vision (2.0 Flash)

Our final, successful implementation runs on Google's multimodal **Gemini Vision** model (`ocr-ingest-gemini-vision.ts`). We provide the image directly to the model along with a strict instruction prompt detailing the exact JSON structure we require.

### Why It Worked Perfectly
Gemini inherently uses a visually aware Large Language Model (LLM) behind the scenes, granting it human-like comprehension of the document.

*   **Exceptional Handwriting Recognition:** Unlike AWS Textract, Document AI, and PaddleOCR—which all severely struggled or outright failed when parsing messy, cursive, or overlapping handwritten inputs—Gemini flawlessly processes complicated handwritten variations in both Thai and English.
*   **Unmatched Contextual Understanding:** It seamlessly handles mixed Thai and English handwriting, understands crossed-out/scratched-out corrections to grab the final intended value, and reads misaligned tables natively.
*   **Smart Inferencing & Data Transformation:** Where standard OCR fails entirely, Gemini understands human nuances and transforms data on the fly. For instance, if a Date of Birth is written as "10 yrs" or "7 ปี", our ingestion script uses Gemini's extraction combined with custom logic to calculate the correct birth year based on the folder's registration year (e.g., `2019 - 10 = 2009`). It also intelligently reformats phone numbers and normalizes fuzzy course names (e.g. converting `Course C-B1 (ENG)` to just `C-B1`) natively in one pass.
*   **Native Structured Output:** We provided a defined JSON Schema representation (Student ID, Nickname, Parent Name, Course Title, etc.). Gemini strictly adheres to this, returning perfectly parseable JSON every single time, entirely eliminating the need for brittle regex matching. It even successfully defaults missing fields (like an absent formal student name falling back to a nickname).
*   **Orientation Agnostic:** It actively detects and successfully extracts text even from upside-down or sideways images (aided by simple EXIF rotation preprocessing).

### Overcoming the Cons (Rate Limits)
The primary downside to Gemini Vision on the free/standard tiers is stringent API Rate Limiting (429 errors). We successfully solved this limitation in our script by:
1.  **API Key Rotation:** We provisioned three separate API keys (`GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`).
2.  **Smart Backoff Strategy:** The ingest script tracks an array of keys and immediately skips to the next available project key using round-robin rotation upon hitting a 429 rate limit. Combined with a progressive exponential backoff timeout, it maintains a steady, uninterrupted ingestion flow over hundreds of images without crashing.

### Conclusion
By leveraging the spatial and linguistic reasoning capabilities of Gemini Vision paired with key-rotation, we engineered a single-step API process that is significantly more accurate, far easier to maintain (no regex/parsing code), and heavily resilient to handwriting and format variations.
