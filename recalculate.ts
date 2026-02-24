import * as fs from 'fs';

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
Project: Cascade PID Controller for stabilizing Inverted Pendulum Kiddee Robot	
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

const dbCourses = JSON.parse(fs.readFileSync('courses_dump.json', 'utf8'));

const canonicalCourses = [];
final61Text.trim().split('\n').forEach(line => {
    const parts = line.split('\t').map(p => p.trim());
    if (parts.length >= 4) {
        canonicalCourses.push({
            id: parseInt(parts[0]),
            title: parts[1],
            ageRange: parts[2],
            medium: parts[3]
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
    
    return null;
}

const unmappedRules = [];
const parsedMappings = mappingsText.trim().split('\n').map(line => {
    const parts = line.split('\t').map(p => p.trim());
    return {
        sourceTitle: parts[0],
        targetRaw: parts[1] || ''
    };
});

const operations = []; // What we actually do
const dbMasters = dbCourses.filter(c => c.id <= 61);

// Phase 1: Overwrite IDs 1-61 in database to match canonical exactly
let updateCount = 0;
for (const canonical of canonicalCourses) {
    const dbC = dbMasters.find(c => c.id === canonical.id);
    if (!dbC || dbC.title !== canonical.title || dbC.ageRange !== canonical.ageRange || dbC.medium !== canonical.medium) {
        operations.push({
            type: 'UPDATE_MASTER',
            id: canonical.id,
            oldTitle: dbC?.title,
            newTitle: canonical.title,
            newAge: canonical.ageRange,
            newMedium: canonical.medium
        });
        updateCount++;
    }
}

// Phase 2: Apply mappings for > 61 (and some within <=61 if they are duplicate and explicitly mapped to be consolidated)
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
                mappingPlan.push({ action: 'CONSOLIDATE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, targetId: canonicalId, targetTitle: canonicalCourses.find(c => c.id === canonicalId).title });
            }
        } else {
            // Provided a target but we can't find it in canonical 61
            if (mappingRule.targetRaw === '') {
                 mappingPlan.push({ action: 'LEAVE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, reason: 'Target was blank in mapping list' });
            } else {
                mappingPlan.push({ action: 'LEAVE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, reason: \`Target "\${mappingRule.targetRaw}" not found in 1-61\` });
            }
        }
    } else {
        // No explicit rule in the text provided
        if (sourceCourse.id > 61) {
            // Packages / Special
            if (['4 courses package', '10 courses package', '2 courses package', 'TBC'].includes(sourceCourse.title)) {
                mappingPlan.push({ action: 'LEAVE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, reason: 'Package / Meta course' });
            } else {
                mappingPlan.push({ action: 'LEAVE', sourceId: sourceCourse.id, sourceTitle: sourceCourse.title, reason: 'Course ID > 61 and no mapping rule provided' });
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
