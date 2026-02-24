const fs = require('fs');
const p = JSON.parse(fs.readFileSync('./plan_summary.json', 'utf8'));

let md = '# Course Consolidation Detailed Report\n\n';
md += 'This document breaks down exactly which courses fall into which category during the consolidation process.\n\n';

md += '## 🗑️ Deletions (' + p.deletions.length + ')\n';
md += 'These courses will be deleted. They were explicitly marked for deletion or mapped to a blank target in the mapping list.\n\n';
p.deletions.forEach(d => {
  md += '- ID ' + d.sourceId + ': **' + d.sourceTitle + '** (Reason: ' + d.reason + ')\n';
});

md += '\n## 🔀 Consolidations (' + p.consolidations.length + ')\n';
md += 'These redundant courses will have their schedules/sessions moved to the Canonical ID, and then the original redundant course ID will be deleted.\n\n';
md += '| Old ID | Old Title | --> | New Master ID | New Master Title |\n';
md += '|---|---|---|---|---|\n';
p.consolidations.forEach(c => {
  md += '| ' + c.sourceId + ' | ' + c.sourceTitle + ' | --> | **' + c.targetId + '** | **' + c.targetTitle + '** |\n';
});

md += '\n## ✏️ Updates to Canonical Masters 1-61 (' + p.updatesToMaster.length + ')\n';
md += 'These existing courses (IDs 1-61) will be renamed/updated to exactly match the titles, ages, and mediums you provided in your final 61 list.\n\n';
md += '| ID | Old DB Title | New Canonical Title | Age Range | Medium |\n';
md += '|---|---|---|---|---|\n';
p.updatesToMaster.forEach(u => {
  md += '| ' + u.id + ' | ' + (u.oldTitle || 'N/A') + ' | **' + u.newTitle + '** | ' + u.newAge + ' | ' + u.newMedium + ' |\n';
});

md += '\n## ⏸️ Left Alone / Extra Courses (' + p.leftAloneExtra.length + ')\n';
md += 'These courses (mostly ID > 61) had no mapping provided and are not in the 1-61 list. They will be left perfectly intact as independent courses.\n\n';
p.leftAloneExtra.forEach(l => {
  md += '- ID ' + l.sourceId + ': **' + l.sourceTitle + '**\n';
});

const path = require('path');
const docsDir = 'c:/Users/Saw/Desktop/kdl-lms/docs';
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
fs.writeFileSync(path.join(docsDir, 'course_consolidation_report.md'), md);
console.log('Report generated.');
