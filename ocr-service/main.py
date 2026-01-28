import sys
import os
# Disable OneDNN to avoid "ConvertPirAttribute2RuntimeAttribute" errors
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0" 
import json
import logging
# Suppress paddle welcome message
logging.getLogger("ppocr").setLevel(logging.ERROR)

# Redirect stdout to stderr to capture library noise
original_stdout = sys.stdout
sys.stdout = sys.stderr

try:
    from paddleocr import PaddleOCR
    from PIL import Image
    import numpy as np
except ImportError:
    sys.stdout = original_stdout # Restore for error
    print(json.dumps({"error": "Missing dependencies. Run: pip install paddlepaddle paddleocr Pillow"}))
    sys.exit(1)

# Configuration constants - UNIFIED ACROSS ALL OCR SCRIPTS
KEYWORDS = ['student', 'id', 'name', 'nickname', 'school', 'course', 'mobile', 'date of birth', 'teacher']
# Critical keywords that strongly indicate correct orientation (Student ID is most important)
CRITICAL_KEYWORDS = ['student', 'id']  # These keywords are weighted more heavily
MIN_CONFIDENCE = 0.4  # Minimum confidence threshold for OCR results (lowered from 0.5 to catch more text)
MIN_KEYWORD_MATCHES = 2  # Minimum keyword matches to consider result "good"

# PaddleOCR Singleton - Module-level singleton (reused across calls for performance)
# This ensures only ONE instance exists throughout the script's lifetime
_ocr_instance = None

def get_ocr():
    """Get or create PaddleOCR instance (singleton pattern for performance)"""
    global _ocr_instance
    if _ocr_instance is None:
        # Disable internal angle classifier since we are doing manual exhaustive search
        _ocr_instance = PaddleOCR(use_angle_cls=False, lang='en')
    return _ocr_instance

def run_ocr():
    # Parse args
    image_path = sys.argv[1]
    exhaustive_mode = "--exhaustive" in sys.argv

    # Get PaddleOCR instance (singleton, reused across calls)
    ocr = get_ocr()
    
    # Optimized rotation: Most images are 0° (upright) or 270° (clockwise 90°)
    # Phase 1: Try common orientations first (0°, 270°)
    # Phase 2: Only try 90°, 180° if Phase 1 scores are too low
    primary_angles = [0, 270]  # Most common orientations
    fallback_angles = [90, 180]  # Less common, only try if needed
    
    best_result = None
    best_score = -1
    best_angle = 0
    
    try:
        pil_img = Image.open(image_path)
    except Exception as e:
        sys.stdout = original_stdout
        print(json.dumps({"error": f"Failed to open image: {str(e)}"}))
        return

    # Phase 1: Try primary angles (0°, 270°) - covers ~95% of images
    # Both normal and exhaustive mode only try these two angles
    for angle in primary_angles:
        # Rotate image (in memory)
        if angle == 0:
            img_array = np.array(pil_img)
        else:
            rotated = pil_img.rotate(angle, expand=True)
            img_array = np.array(rotated)

        result = ocr.ocr(img_array)
        
        # Calculate score using unified keyword list with weighted critical keywords
        current_score = 0
        if result and result[0]:
            joined_text = " ".join([line[1][0].lower() for line in result[0]])
            # Count all keyword matches
            for k in KEYWORDS:
                if k in joined_text:
                    # Critical keywords (student, id) get double weight
                    if k in CRITICAL_KEYWORDS:
                        current_score += 2
                    else:
                        current_score += 1
        
        # Debug info
        sys.stderr.write(f"  [Debug] Angle {angle}: Score {current_score}\n")
        
        # In normal mode: Stop early if good result found
        # In exhaustive mode: Try both angles regardless of score
        if not exhaustive_mode and current_score >= MIN_KEYWORD_MATCHES:
            best_score = current_score
            best_result = result
            best_angle = angle
            # Found good result in primary angles, skip remaining angles
            break
            
        if current_score > best_score:
            best_score = current_score
            best_result = result
            best_angle = angle
    
    # Phase 2: Only try fallback angles (90°, 180°) if Phase 1 didn't find good result
    # Note: We never try fallback angles in exhaustive mode - only 0° and 270°
    # This saves time since most images are 0° or 270°
    if not exhaustive_mode and best_score < MIN_KEYWORD_MATCHES and best_score >= 0:
        # Try fallback angles only if:
        # - NOT in exhaustive mode (exhaustive only tries 0° and 270°)
        # - Best score from Phase 1 is below threshold (might be wrong orientation)
        for angle in fallback_angles:
            # Rotate image (in memory)
            rotated = pil_img.rotate(angle, expand=True)
            img_array = np.array(rotated)

            result = ocr.ocr(img_array)
            
            # Calculate score using unified keyword list with weighted critical keywords
            current_score = 0
            if result and result[0]:
                joined_text = " ".join([line[1][0].lower() for line in result[0]])
                # Count all keyword matches
                for k in KEYWORDS:
                    if k in joined_text:
                        # Critical keywords (student, id) get double weight
                        if k in CRITICAL_KEYWORDS:
                            current_score += 2
                        else:
                            current_score += 1
            
            # Debug info
            sys.stderr.write(f"  [Debug] Angle {angle}: Score {current_score}\n")
            
            # Stop early if we find a good result
            if current_score >= MIN_KEYWORD_MATCHES:
                best_score = current_score
                best_result = result
                best_angle = angle
                break
                
            if current_score > best_score:
                best_score = current_score
                best_result = result
                best_angle = angle
            
    # Format the best result with confidence filtering
    formatted_output = []
    
    if best_result and best_result[0]:
        for line in best_result[0]:
            text = line[1][0]
            confidence = line[1][1]
            # Filter by confidence threshold
            if confidence >= MIN_CONFIDENCE:
                formatted_output.append({
                    "text": text,
                    "confidence": confidence
                })
            
    # Print JSON result to stdout for Node.js to capture
    sys.stdout = original_stdout
    print(json.dumps(formatted_output))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)
        
    # Logic moved inside run_ocr to use sys.argv directly for flags
    run_ocr()
