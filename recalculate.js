const fs = require('fs');
const path = require('path');

const final61Text = `
1	Tinkamo Tinkerer Begineer		5-6 yrs	iPad
2	TInkamo Tinkerer Intermediate I		5-6 yrs	iPad
3	Tinkamo TInkerer Intermediate II		5-6 yrs	iPad
4	Fun Coding and AR with Botzees		5-6 yrs	iPad
5	Fun Coding with Botzees Intermediate		5-6 yrs	iPad
6	Fun Coding with mTIny		5-6 yrs	iPad
7	Fun Coding with Lego Boost		6-8 yrs	iPad
8	Codey Rocky Champion		6-8 yrs	iPad
9	Codey Rocky Champion Intermediate		7-8 yrs	iPad
10	Fun Coding with mBot Beginner (K)		7-8 yrs	iPad
11	Fun Coding with mBot Intermediate I (K)		7-8 yrs	iPad
12	Fun Coding with mBot Intermediate II (K)		7-8 yrs	iPad
13	Minecraft Education (Scratch)		7-8 yrs	iPad
14	Creativity with 3D Modeling (Tinkercad)		7-8 yrs	iPad
15	Creativity with 3D Modeling Project		7-8 yrs	iPad
16	Fun Coding with mBot Beginner (C)		9-12 yrs	Computer
17	Fun Coding with mBot Intermediate I (C)		9-12 yrs	Computer
18	Fun Coding with mBot Intermediate II (C)		9-12 yrs	Computer
19	Fun Coding with mBot Advanced		9-12 yrs	Computer
20	Animation and Game Creator		8-12 yrs	Computer
21	VEX Robotics Starter (VEX IQ)		9-12 yrs	Computer
22	VEX IQ Roboticcs Competition I		9-12 yrs	Computer
23	VEX IQ Roboticcs Competition II		9-12 yrs	Computer
24	VEX Robotics Workshop		9-12 yrs	Computer
25	Vex Earthquake Project		9-12 yrs	Computer
26	Robomaster Workshop		9-12 yrs	Computer
27	Robomaster		9-12 yrs	Computer
28	Mastering Halocode Beginner		9-12 yrs	Computer
29	Mastering Halocode Intermediate		9-12 yrs	Computer
30	Advanced Game Creator with Joystick		9-12 yrs	Computer
31	2 Players Game Creator		9-12 yrs	Computer
32	Creativity with 3D Modeling (Tinkercad)		9-12 yrs	Computer
33	Creativity with 3D Modeling Project (Tinkercad)		9-12 yrs	Computer
34	Minecraft Education (Scratch)		9-12 yrs	Computer
35	Minecraft Education (Python)		9-12 yrs	Computer
36	Application Design (MIT App Inventor)		9-18 yrs	Computer
37	Game Design Roblox Studio Beginner		9-15 yrs	Computer
38	Game Design Roblox Studio Intermediate		9-15 yrs	Computer
39	Everyday Electronics		12-18 yrs	Computer
40	UX/UI Design		12-18 yrs	Computer
41	Web Design Development		13+ yrs	Computer
42	Pure Python I		13+ yrs	Computer
43	Python Project Based		13+ yrs	Computer
44	Game Development with Python I		13+ yrs	Computer
45	Game Development with Python II		13+ yrs	Computer
46	Data Handling/ Data Science		13+ yrs	Computer
47	Creativity with 3D Modeling (Shapr3D)		13+ yrs	Computer
48	Creativity with 3D Modeling Project (Shapr3D)		13+ yrs	Computer
49	Exploring Arduino with Python I		13+ yrs	Computer
50	Exploring Arduino with Python II		13+ yrs	Computer
51	Challenge with Application Project		13+ yrs	Computer
52	Welcome to World of IoT (ESP32)		13+ yrs	Computer
53	Getting to know a Robot Arm		13+ yrs	Computer
54	Machine Learning I		14+ yrs	Computer
55	Machine Learning II		14+ yrs	Computer
56	A Level		17+ yrs	Computer
57	IGCSE: Computer Science		14+ yrs	Computer
58	IGCSE: Math		14+ yrs	Computer
59	Digital Literacy Workshop		9+ yrs	Computer
60	Special Project		16+ yrs	Computer
61	Free Trial		-	-
`;

const mappingsText = `
Halocode Intermediate	Mastering Halocode Intermediate
Halocode Beginner	Mastering Halocode Beginner
VEX Competition Training	VEX IQ Roboticcs Competition I
Botzees Beginner	Fun Coding and AR with Botzees
Botzees Intermediate	Fun Coding with Botzees Intermediate
K-mBot Beginner	Fun Coding with mBot Beginner (K)
C-mBot Beginner	Fun Coding with mBot Beginner (C)
C-mBot Intermediate I	Fun Coding with mBot Intermediate I (C)
Pygame	Game Development with Python I
K-mBot Intermediate I	Fun Coding with mBot Intermediate I (K)
IOT	Welcome to World of IoT (ESP32)
Robot Arm	Getting to know a Robot Arm
Funjai	Funjai is special project
3D Design and Printing	Creativity with 3D Modeling (Tinkercad)
Roblock	Game Design Roblox Studio Beginner
3D (Tinkercad) Project	Creativity with 3D Modeling Project
Roblox Beginner	Game Design Roblox Studio Beginner
Roblox Game Design	Game Design Roblox Studio Beginner
C-mBot Intermediate II	Fun Coding with mBot Intermediate II (C)
3D	Creativity with 3D Modeling (Tinkercad)
A Level	A Level
Codey Rocky Beginner	Codey Rocky Champion
Python Beginner	Pure Python I
VEX Beginner	VEX Robotics Starter (VEX IQ)
Mit App(1000)	Application Design (MIT App Inventor)
K-mBot Intermediate II	Fun Coding with mBot Intermediate II (K)
K-Intermediate	Fun Coding with mBot Intermediate I (K)
VEX continue	just continue VEX what they learn in this case should be VEX IQ Roboticcs Competition I
3D TInkercad	Creativity with 3D Modeling (Tinkercad)
Tinkamo Intermediate	TInkamo Tinkerer Intermediate I
3D Halloween	special festive
3D Design	Creativity with 3D Modeling (Tinkercad)
VEX	VEX Robotics Starter (VEX IQ)
Halocode	Mastering Halocode Beginner
Funjai Project	Special project
IGCSE Computer Science	IGCSE: Computer Science
3D Tinkercad Project	Creativity with 3D Modeling Project (Tinkercad)
Project: Cascade PID Controller for stabilizing Inverted Pendulum Kiddee Robot	Special Project
Digital Literacy	Digital Literacy Workshop
Project	Special project
IGCSE	IGCSE: Computer Science
Python	Pure Python I
3D Project	Creativity with 3D Modeling Project (Tinkercad)
Kid 5 days 5 activities	Don't want to use anymore
3D Course	Creativity with 3D Modeling (Tinkercad)
3D Shapr3D	Creativity with 3D Modeling (Shapr3D)
Arduino I + II	Exploring Arduino with Python I
Vex Earthquake Project	Vex Earthquake Project
UX/UI	UX/UI Design
`;

// Explicit dictionary for semantic mapping of remaining unmapped courses
const semanticDictionary = {
    99: 17, // C-Challenge1 -> C-mBot Intermediate I
    100: 17, // C-B3L1 -> C-mBot Intermediate I
    101: 41, // Full Stax -> Web Design Development
    102: 10, // K C -> K-mBot Beginner
    103: 60, // Intermediate1/2/3 -> Special Project
    104: 60, // Summer Course Kids -> Special Project
    105: 28, // Summer Camp Movie+Halocode -> Mastering Halocode Beginner
    106: 17, // C-Challenge1-2 -> C-mBot Intermediate I
    107: 17, // C-Movie 2 -> C-mBot Intermediate I
    108: 60, // Summer Course Child -> Special Project
    109: 60, // Summer Course Child: Beginner and Intermediate -> Special Project
    110: 60, // Beginner and Intermediate -> Special Project
    111: 10, // K2C-Beginner -> K-mBot Beginner
    112: 60, // Child: Beginner and Intermediate -> Special Project
    113: 51, // Application Project -> Challenge with Application Project
    114: 51, // Python Application Project -> Challenge with Application Project
    115: 29, // Halo Code 3 + Python -> Mastering Halocode Intermediate
    116: 14, // 3D 1 day workshop -> Creativity with 3D Modeling (Tinkercad)
    117: 10, // K-B1L1 -> K-mbot Beginner
    118: 1, // PK- Tinkamo Beginner -> Tinkamo Tinkerer Begineer
    119: 17, // C-Movie 2-3 -> C-mBot Intermediate I
    120: 2, // PK-Intermediate -> TInkamo Tinkerer Intermediate I
    121: 1, // PK-Beginner 4 -> Tinkamo Tinkerer Begineer
    122: 1, // PK-Beginner 3 -> Tinkamo Tinkerer Begineer
    123: 1, // PK-Beginner 2 -> Tinkamo Tinkerer Begineer
    124: 1, // PK-Beginner1 -> Tinkamo Tinkerer Begineer
    125: 1, // Beginner 123 -> Tinkamo Tinkerer Begineer
    126: 8, // PK- Codey Rocky Beginner -> Codey Rocky Champion
    127: 20, // Animation & Game Creator 3 -> Animation and Game Creator
    128: 1, // Tinkamo Beginner 2-3 -> Tinkamo Tinkerer Begineer
    129: 11, // K-mBot Beginner + Intermediate I -> Fun Coding with mBot Intermediate I (K)
    130: 24, // VEX RoboSoccer 1 day workshop -> VEX Robotics Workshop
    131: 3, // Tinkamo Intermediate II -> Tinkamo TInkerer Intermediate II
    132: 13, // Minecraft Scratch II -> Minecraft Education (Scratch)
    133: 60, // Project camp -> Special Project
    134: 60, // Swift -> Special Project
    135: 60, // Science and Maths -> Special Project
    136: 11, // K-mBot Intermediate + MC Scratch -> Fun Coding with mBot Intermediate I (K)
    137: 54, // Machine Learning -> Machine Learning I
    138: 55, // Machine Learning with Balancing Ball -> Machine Learning II
    139: 60, // Robotics -> Special Project
    140: 60, // K6BILI & BILZ -> Special Project
    141: 10, // mbot mt 1 -> Fun Coding with mBot Beginner (K)
    142: 60, // My SQL -> Special Project
    143: 60, // NJID -> Special Project
    144: 60, // Ferris Wheel -> Special Project
    145: 60, // 4 days camp -> Special Project
    146: 60, // 2 days 2 activities -> Special Project
    147: 60, // Botzees/mTiny 2 days/ Tinkamo 2 days -> Special Project
    148: 14, // 3D Design and Printing- K-mbot Int. -> Creativity with 3D Modeling (Tinkercad)
    149: 60, // Embedded System -> Special Project
    150: 9, // Codey Rocky Intermediate 1125 -> Codey Rocky Champion Intermediate
    151: 60, // 1 Day Workshop: 3D Halloween -> Special Project
    152: 11, // mBot Intermediate 1 class -> Fun Coding with mBot Intermediate I (K)
    153: 4, // Botzees 1 class -> Fun Coding and AR with Botzees
    154: 36 // Android Course -> Application Design (MIT App Inventor)
};

const dbCourses = JSON.parse(fs.readFileSync('courses_dump.json', 'utf8'));

const canonicalCourses = [];
final61Text.trim().split(/\r?\n/).forEach(line => {
    const parts = line.split(/\t/).map(p => p.trim()).filter(p => p !== '');
    if (parts.length >= 3) {
        canonicalCourses.push({
            id: parseInt(parts[0]),
            title: parts[1],
            ageRange: parts[2],
            medium: parts[3] || ''
        });
    }
});

// Helper to find target canonical ID
function findCanonicalId(targetTitle) {
    if (!targetTitle) return null;
    const lower = targetTitle.toLowerCase();
    
    // exact matches
    let match = canonicalCourses.find(c => c.title.toLowerCase() === lower);
    if (match) return match.id;
    
    // aliases handling
    if (lower.includes('special project') || lower.includes('special festive') || lower.includes('funjai is special project')) return 60; // Special Project
    if (lower.includes('vex iq roboticcs competition i')) return 22;
    if (lower.includes("don't want to use anymore")) return 'DELETE';
    if (lower.includes('creativity with 3d modeling project (tinkercad)')) return 33;
    if (lower.includes('creativity with 3d modeling (tinkercad)')) return 32;
    if (lower.includes('ux/ui design')) return 40;
    if (lower.includes('igcse: computer science')) return 57;
    if (lower.includes('digital literacy workshop')) return 59;
    
    return null;
}

const parsedMappings = [];
mappingsText.trim().split(/\r?\n/).forEach(line => {
    // Some lines might be separated by a tab, others by multiple spaces if copy pasted.
    const parts = line.split(/\t/);
    if (parts.length > 1) {
        parsedMappings.push({
            sourceTitle: parts[0].trim(),
            targetRaw: parts.slice(1).join('\t').trim() || ''
        });
    } else {
        // Try multiple spaces
        const spaceParts = line.split(/\s{2,}/);
        if (spaceParts.length > 1) {
            parsedMappings.push({
                sourceTitle: spaceParts[0].trim(),
                targetRaw: spaceParts.slice(1).join(' ').trim() || ''
            });
        }
    }
});

const operations = []; 
const dbMasters = dbCourses.filter(c => c.id <= 61);

for (const canonical of canonicalCourses) {
    const dbC = dbMasters.find(c => c.id === canonical.id);
    if (!dbC || dbC.title !== canonical.title || dbC.ageRange !== canonical.ageRange || dbC.medium !== canonical.medium) {
        operations.push({
            type: 'UPDATE_MASTER',
            id: canonical.id,
            oldTitle: dbC ? dbC.title : null,
            newTitle: canonical.title,
            newAge: canonical.ageRange,
            newMedium: canonical.medium
        });
    }
}


const mappingPlan = [];

for (const sourceCourse of dbCourses) {
    // Check if there's an explicit mapping for this title
    const mappingRule = parsedMappings.find(m => m.sourceTitle.toLowerCase() === sourceCourse.title.trim().toLowerCase());
    
    if (mappingRule) {
        const canonicalId = findCanonicalId(mappingRule.targetRaw);
        if (canonicalId === 'DELETE') {
            mappingPlan.push({ action: 'DELETE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, reason: 'Explicit delete request' });
        } else if (canonicalId) {
            // we have a target ID
            if (sourceCourse.id === canonicalId) {
                // it's already the canonical one, do nothing
            } else {
                mappingPlan.push({ action: 'CONSOLIDATE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, targetId: canonicalId, targetTitle: canonicalCourses.find(c => c.id === canonicalId).title, reason: 'Explicit mapping list' });
            }
        } else {
            // Provided a target but we can't find it in canonical 61
            if (mappingRule.targetRaw === '') {
                 mappingPlan.push({ action: 'DELETE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, reason: 'Target was blank in mapping list' });
            } else {
                mappingPlan.push({ action: 'LEAVE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, reason: 'Target ' + mappingRule.targetRaw + ' not found in 1-61' });
            }
        }
    } else {
        // No explicit rule in the text provided
        if (sourceCourse.id > 61) {
            
            const autoId = semanticDictionary[sourceCourse.id];
            
            if (autoId) {
                const targetC = canonicalCourses.find(c => c.id === autoId);
                mappingPlan.push({ action: 'CONSOLIDATE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, targetId: autoId, targetTitle: targetC.title, reason: 'Auto-mapped by semantic language matching' });
            } else {
               mappingPlan.push({ action: 'LEAVE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, reason: 'Unmapped package or special core concept' });
            }
        }
    }
}

fs.writeFileSync('plan_summary.json', JSON.stringify({
    canonicalTotal: canonicalCourses.length,
    updatesToMaster: operations.filter(o => o.type === 'UPDATE_MASTER'),
    consolidations: mappingPlan.filter(m => m.action === 'CONSOLIDATE'),
    deletions: mappingPlan.filter(m => m.action === 'DELETE'),
    leftAloneExtra: mappingPlan.filter(m => m.action === 'LEAVE'),
}, null, 2));

console.log('Summary computed natively against final 1-61 list.');
