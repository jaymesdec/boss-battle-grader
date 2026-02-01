// =============================================================================
// TD Competencies - Franklin School's 9 Transdisciplinary Competencies
// =============================================================================

import type { Competency, CompetencyId, Grade } from '@/types';

export const COMPETENCIES: Record<CompetencyId, Competency> = {
  collaboration: {
    id: 'collaboration',
    name: 'Collaboration',
    emoji: '🤝',
    description: 'Works productively and respectfully with others to achieve shared goals.',
    color: '#FF6B6B',
  },
  communication: {
    id: 'communication',
    name: 'Storytelling / Communication',
    emoji: '💬',
    description: 'Communicates ideas clearly, creatively, and appropriately for audience and purpose.',
    color: '#4ECDC4',
  },
  reflexivity: {
    id: 'reflexivity',
    name: 'Reflexivity',
    emoji: '🪞',
    description: 'Reflects critically on learning, decisions, and assumptions.',
    color: '#45B7D1',
  },
  empathy: {
    id: 'empathy',
    name: 'Empathy / Perspective Taking',
    emoji: '💛',
    description: 'Demonstrates understanding and respect for others\' perspectives and experiences.',
    color: '#FFD93D',
  },
  knowledge: {
    id: 'knowledge',
    name: 'Knowledge-Based Reasoning',
    emoji: '📚',
    description: 'Applies disciplinary and interdisciplinary knowledge to solve problems.',
    color: '#6C5CE7',
  },
  futures: {
    id: 'futures',
    name: 'Futures Thinking',
    emoji: '🔮',
    description: 'Envisions and prepares for multiple and preferred futures.',
    color: '#A29BFE',
  },
  systems: {
    id: 'systems',
    name: 'Systems Thinking',
    emoji: '🕸️',
    description: 'Identifies and understands interconnections within and across systems.',
    color: '#00CEC9',
  },
  adaptability: {
    id: 'adaptability',
    name: 'Adaptability',
    emoji: '🔄',
    description: 'Responds constructively to change and ambiguity.',
    color: '#FD79A8',
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    emoji: '🚀',
    description: 'Takes initiative and ownership of learning and actions.',
    color: '#00FFAA',
  },
};

export const COMPETENCY_ORDER: CompetencyId[] = [
  'collaboration',
  'communication',
  'reflexivity',
  'empathy',
  'knowledge',
  'futures',
  'systems',
  'adaptability',
  'agency',
];

// Design & Tech rubric descriptors
export const RUBRIC_DESCRIPTORS: Record<CompetencyId, Record<Grade, string>> = {
  collaboration: {
    'A+': 'Integrates diverse ideas to develop superior outcomes and facilitates inclusion.',
    'A': 'Shares leadership, listens well, and improves collective work.',
    'B': 'Contributes ideas and completes role cooperatively.',
    'C': 'Relies on peers for direction; passive in group decisions.',
    'D': 'Disengaged or struggles with group communication.',
    'F': 'Refuses to participate or blocks group progress.',
  },
  communication: {
    'A+': 'Communicates design choices with impact, purpose, and user awareness.',
    'A': 'Explains processes and reasoning effectively.',
    'B': 'Presents basic structure and tools used.',
    'C': 'Shares limited insight into choices.',
    'D': 'Communicates process poorly or incompletely.',
    'F': 'No communication or context provided.',
  },
  reflexivity: {
    'A+': 'Critiques design choices and future improvements.',
    'A': 'Recognizes user feedback and adapts design.',
    'B': 'Comments on product development.',
    'C': 'Gives surface-level review of product.',
    'D': 'Fails to recognize iterative process.',
    'F': 'No reflection on design process.',
  },
  empathy: {
    'A+': 'Centers design on user wellbeing, accessibility, and dignity.',
    'A': 'Applies user feedback meaningfully.',
    'B': 'Incorporates basic user-centered thinking.',
    'C': 'Acknowledges user needs superficially.',
    'D': 'Overlooks key user perspectives.',
    'F': 'Design disregards or harms user interests.',
  },
  knowledge: {
    'A+': 'Bases design on deep research and interdisciplinary knowledge.',
    'A': 'Makes informed decisions using data.',
    'B': 'Uses basic knowledge to support ideas.',
    'C': 'Design lacks rationale.',
    'D': 'Unsupported or random design choices.',
    'F': 'No clear thinking or evidence shown.',
  },
  futures: {
    'A+': 'Designs systems anticipating future user or planetary needs.',
    'A': 'Creates sustainable or futuristic products thoughtfully.',
    'B': 'Explores improvements with guidance.',
    'C': 'Overlooks long-term consequences.',
    'D': 'Short-term or impractical design.',
    'F': 'Ignores future needs.',
  },
  systems: {
    'A+': 'Designs with multiple systems and users in mind; maps effects.',
    'A': 'Considers cause/effect and user interdependence.',
    'B': 'Designs address some interactions or usability.',
    'C': 'Limited systems view in planning.',
    'D': 'Ignores system implications.',
    'F': 'No integration of systems thinking.',
  },
  adaptability: {
    'A+': 'Responds to critique with inventive, positive revisions.',
    'A': 'Updates plans based on results and testing.',
    'B': 'Changes parts of design with prompting.',
    'C': 'Resists changes or iterates minimally.',
    'D': 'Ignores design problems.',
    'F': 'Abandons work when revision needed.',
  },
  agency: {
    'A+': 'Proactively leads, iterates designs, and proposes innovative solutions.',
    'A': 'Manages project stages effectively and demonstrates independent ideas.',
    'B': 'Completes designs with moderate independence and creativity.',
    'C': 'Follows guidance to complete basic designs.',
    'D': 'Requires assistance to maintain progress.',
    'F': 'Avoids or neglects assigned work.',
  },
};

export function getCompetencyList(): Competency[] {
  return COMPETENCY_ORDER.map((id) => COMPETENCIES[id]);
}

export function getRubricDescriptor(competencyId: CompetencyId, grade: Grade): string {
  return RUBRIC_DESCRIPTORS[competencyId][grade];
}
