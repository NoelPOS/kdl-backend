const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../courses_2025.csv');
console.log(`Repairing ${filePath}...`);

if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Regex handles \r\n, \n, OR \r (Mac Classic)
    const lines = content.split(/\r\n|\r|\n/);
    
    // Filter for valid ID rows (Header OR ID <= 100)
    const cleanLines = lines.filter(line => {
        const timmed = line.trim();
        if (!timmed) return false;
        if (timmed.startsWith('id,')) return true; // Header
        
        const cols = timmed.split(',');
        const id = parseInt(cols[0]);
        // Keep original 100 courses. 
        return !isNaN(id) && id <= 100;
    });

    // Join with standard \n
    const newContent = cleanLines.join('\n') + '\n';
    
    fs.writeFileSync(filePath, newContent);
    console.log(`Repaired. Kept ${cleanLines.length} lines.`);
} else {
    console.error("File not found!");
}
