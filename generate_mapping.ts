import * as fs from 'fs';

const userMappingText = `
	Robomaster	Using dji robotic to learn
	Halocode Intermediate	Mastering Halocode Intermediate
	Halocode Beginner	Mastering Halocode Beginner
	VEX Competition Training	VEX IQ Roboticcs Competition I
	Botzees Beginner	Fun Coding and AR with Botzees
	Botzees Intermediate	Fun Coding with Botzees Intermediate
60	K-mBot Beginner	Fun Coding with mBot Beginner (K)
61	C-mBot Beginner	Fun Coding with mBot Beginner (C)
62	C-mBot Intermediate I	Fun Coding with mBot Intermediate I (C)
63	Pygame	Game Development with Python I
64	K-mBot Intermediate I	Fun Coding with mBot Intermediate I (K)
65	IOT	Welcome to World of IoT (ESP32)
66	Robot Arm	Getting to know a Robot Arm
67	Funjai	Special Project
68	3D Design and Printing	Creativity with 3D Modeling (Tinkercad)
69	Roblock	Game Design Roblox Studio Beginner
70	3D (Tinkercad) Project	Creativity with 3D Modeling Project
71	Roblox Beginner	Game Design Roblox Studio Beginner
72	Roblox Game Design	Game Design Roblox Studio Beginner
73	C-mBot Intermediate II	Fun Coding with mBot Intermediate II (C)
74	3D	Creativity with 3D Modeling (Tinkercad)
75	A Level	A Level
76	Codey Rocky Beginner	Codey Rocky Champion
77	Python Beginner	Pure Python I
78	VEX Beginner	VEX Robotics Starter (VEX IQ)
79	Mit App(1000)	Application Design (MIT App Inventor)
80	K-mBot Intermediate II	Fun Coding with mBot Intermediate II (K)
81	K-Intermediate	Fun Coding with mBot Intermediate I (K)
82	VEX continue	VEX IQ Roboticcs Competition I
83	3D TInkercad	Creativity with 3D Modeling (Tinkercad)
84	Tinkamo Intermediate	TInkamo Tinkerer Intermediate I
85	3D Halloween	Special Project
86	3D Design	Creativity with 3D Modeling (Tinkercad)
87	VEX	VEX Robotics Starter (VEX IQ)
88	Halocode	Mastering Halocode Beginner
89	Funjai Project	Special Project
90	IGCSE Computer Science	IGCSE: Computer Science
91	3D Tinkercad Project	Creativity with 3D Modeling Project (Tinkercad)
92	Project: Cascade PID Controller for stabilizing Inverted Pendulum Kiddee Robot	Special Project
93	Digital Literacy	Digital Literacy Workshop
94	Project	Special Project
95	IGCSE	IGCSE: Computer Science
96	Python	Pure Python I
97	3D Project	Creativity with 3D Modeling Project (Tinkercad)
98	Kid 5 days 5 activities	DELETE
99	3D Course	Creativity with 3D Modeling (Tinkercad)
100	3D Shapr3D	Creativity with 3D Modeling (Shapr3D)
101	Arduino I + II	Exploring Arduino with Python I
102	Vex Earthquake Project	Vex Earthquake Project
103	UX/UI	UX/UI Design
`;

const courses = JSON.parse(fs.readFileSync('courses_dump.json', 'utf8'));

// To help find master ID by ideal title
const getMasterId = (title) => {
  const norm = title.trim().toLowerCase();
  const c = courses.find(course => course.id <= 61 && course.title.trim().toLowerCase() === norm);
  if (c) return c.id;
  
  // if not found among <61, try finding the first match overall
  const c2 = courses.find(course => course.title.trim().toLowerCase() === norm);
  return c2 ? c2.id : null;
};

const map = [];
const lines = userMappingText.trim().split('\n');

for (const line of lines) {
  const parts = line.split('\t').map(p => p.trim());
  if (parts.length >= 3) {
    let sourceId = parseInt(parts[0]);
    let sourceTitle = parts[1];
    let targetTitle = parts[2] === 'Special project' || parts[2] === 'special festive' ? 'Special Project' : parts[2];
    
    if (isNaN(sourceId)) {
        // Find course by sourceTitle
        const c = courses.find(course => course.title.trim() === sourceTitle);
        if (c) sourceId = c.id;
    }

    if (sourceId && targetTitle) {
      if (targetTitle === 'DELETE' || targetTitle === "Don't want to use anymore") {
        map.push({ sourceId, sourceTitle, action: 'DELETE' });
      } else {
        const targetId = getMasterId(targetTitle);
        if (targetId) {
          map.push({ sourceId, sourceTitle, targetId, targetTitle, action: 'CONSOLIDATE' });
        } else {
          map.push({ sourceId, sourceTitle, targetTitle, action: 'UNMAPPED' });
        }
      }
    }
  }
}

// Add the other courses > 103 that don't have mapping just to flag them
const mappedIds = new Set(map.map(m => m.sourceId));
for (const c of courses) {
    if (c.id > 61 && !mappedIds.has(c.id)) {
        // Skip packages/Free trial which are likely valid e.g., 50,51,52,49
        if (!['Free Trial', '4 courses package', '10 courses package', '2 courses package', 'TBC'].includes(c.title)) {
            map.push({ sourceId: c.id, sourceTitle: c.title, targetTitle: null, action: 'UNMAPPED_EXTRA' });
        }
    }
}

fs.writeFileSync('calculated_mapping.json', JSON.stringify(map, null, 2));
console.log('Saved mapped calculated mapping to calculated_mapping.json');
