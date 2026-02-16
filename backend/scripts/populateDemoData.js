#!/usr/bin/env node
/**
 * Complete Demo Data Populator
 * Inserts ALL clubs/organizers, events, and merchandise from Felicity 2026.
 * Based on felicity.iiit.ac.in and clubs.iiit.ac.in screenshots.
 *
 * Run: npm run populate
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Event from '../models/Event.js';

dotenv.config();

// Helper: build a date for Feb 2026 at specific day/hour/minute
const d = (day, hour, minute = 0) => new Date(2026, 1, day, hour, minute);

// ═══════════════════════════════════════════════════
// ALL CLUBS & ORGANIZERS (from clubs.iiit.ac.in)
// ═══════════════════════════════════════════════════
const ALL_ORGANIZERS = [
  // ─── Technical Clubs ───
  { email: '0x1337@clubs.iiit.ac.in', organizerName: '0x1337: The Hacking Club', category: 'technical', description: 'Exploiting vulnerabilities for fun and teaching about security in today\'s world' },
  { email: 'astronautics@clubs.iiit.ac.in', organizerName: 'Astronautics Club', category: 'technical', description: 'Confining our attention to terrestrial matters would be to limit the human spirit. Join us to look beyond the horizons.' },
  { email: 'dsc@clubs.iiit.ac.in', organizerName: 'Developer Student Club', category: 'technical', description: 'Developer Student Club at IIIT Hyderabad' },
  { email: 'erc@clubs.iiit.ac.in', organizerName: 'Electronics and Robotics Club', category: 'technical', description: 'Building robots and electronic projects for a smarter tomorrow' },
  { email: 'isaqc@clubs.iiit.ac.in', organizerName: 'ISAQC: IIIT Society for Applied Quantum Computing', category: 'technical', description: 'Our beliefs, Our Universe' },
  { email: 'osdg@clubs.iiit.ac.in', organizerName: 'Open-Source Developers Group', category: 'technical', description: 'Promoting open-source culture and collaborative development' },
  { email: 'progclub@clubs.iiit.ac.in', organizerName: 'Programming Club', category: 'technical', description: 'Competitive programming and algorithmic problem solving' },
  { email: 'theorygroup@clubs.iiit.ac.in', organizerName: 'Theory Group', category: 'technical', description: 'We must know, we will know!' },

  // ─── Cultural Clubs ───
  { email: 'asec@clubs.iiit.ac.in', organizerName: 'Amateur Sports Enthusiasts Club (ASEC)', category: 'sports', description: 'Promoting amateur sports and fitness among students' },
  { email: 'cyclorama@clubs.iiit.ac.in', organizerName: 'Cyclorama', category: 'cultural', description: 'The Film and Dramatics Society' },
  { email: 'decore@clubs.iiit.ac.in', organizerName: 'Decore – The Design Club', category: 'cultural', description: 'Design from the Core' },
  { email: 'fhc@clubs.iiit.ac.in', organizerName: 'Frivolous Humour Club', category: 'cultural', description: 'Sab Kuch Lite Hai' },
  { email: 'litclub@clubs.iiit.ac.in', organizerName: 'Literary Club', category: 'literary', description: 'Celebrating literature, debates, and the written word' },
  { email: 'pentaprism@clubs.iiit.ac.in', organizerName: 'Pentaprism', category: 'cultural', description: 'The Photography Club of IIITH' },
  { email: 'rouge@clubs.iiit.ac.in', organizerName: 'Rouge - The Fashion Club', category: 'cultural', description: 'Fashion, style and creative expression' },
  { email: 'skateboarding@clubs.iiit.ac.in', organizerName: 'Skateboarding Club', category: 'sports', description: 'Skateboarding culture and community at IIITH' },
  { email: 'tgc@clubs.iiit.ac.in', organizerName: 'The Gaming Club (TGC)', category: 'gaming', description: 'For Gamers By IIITians' },
  { email: 'languageclub@clubs.iiit.ac.in', organizerName: 'The Language Club', category: 'cultural', description: 'Exploring languages and linguistic diversity' },
  { email: 'musicclub@clubs.iiit.ac.in', organizerName: 'The Music Club', category: 'cultural', description: 'Because without music, life would B flat.' },
  { email: 'tvrqc@clubs.iiit.ac.in', organizerName: 'The TV Room Quiz Club (TVRQC)', category: 'cultural', description: 'Quizzing culture and trivia at IIITH' },
  { email: 'danceclub@clubs.iiit.ac.in', organizerName: 'Dance Club', category: 'cultural', description: 'Dance performances, choreography and movement arts' },
  { email: 'artsoc@clubs.iiit.ac.in', organizerName: 'Artsoc', category: 'cultural', description: 'Arts and crafts society' },
  { email: 'debsoc@clubs.iiit.ac.in', organizerName: 'DebSoc', category: 'literary', description: 'Debate society — parliamentary debates and Model United Nations' },
  { email: 'chessclub@clubs.iiit.ac.in', organizerName: 'Chess Club', category: 'sports', description: 'Chess tournaments, puzzles and strategy' },

  // ─── Student Bodies / Councils ───
  { email: 'apex@clubs.iiit.ac.in', organizerName: 'Apex Body', category: 'other', description: 'Apex student governance body' },
  { email: 'campuslife@clubs.iiit.ac.in', organizerName: 'Campus Life Council', category: 'other', description: 'Bringing Campus to Life' },
  { email: 'cmhs@clubs.iiit.ac.in', organizerName: 'Campus Mental Health Support', category: 'other', description: 'Let\'s make college life fun!' },
  { email: 'clubscouncil@clubs.iiit.ac.in', organizerName: 'Clubs Council', category: 'other', description: 'Coordinating all clubs and student activities' },
  { email: 'culturalcouncil@clubs.iiit.ac.in', organizerName: 'Cultural Council', category: 'cultural', description: 'Bringing Campus to Life, One Event at a Time' },
  { email: 'election@clubs.iiit.ac.in', organizerName: 'Election Commission', category: 'other', description: 'Empowering Voices, Fostering Democracy' },
  { email: 'ecell@clubs.iiit.ac.in', organizerName: 'Entrepreneurship Cell', category: 'other', description: 'Fostering startup culture and innovation' },
  { email: 'felicitytf@clubs.iiit.ac.in', organizerName: 'Felicity Taskforce', category: 'cultural', description: 'Felicity 2026 — The Disco Edition' },
  { email: 'fincouncil@clubs.iiit.ac.in', organizerName: 'Finance Council', category: 'other', description: 'Managing student finances and budgets' },
  { email: 'nss@clubs.iiit.ac.in', organizerName: 'National Service Scheme', category: 'other', description: 'Work for Cause. Not for Applause' },
  { email: 'placement@clubs.iiit.ac.in', organizerName: 'Placement Cell', category: 'other', description: 'Career guidance and placement support' },
  { email: 'sportscouncil@clubs.iiit.ac.in', organizerName: 'Sports Council', category: 'sports', description: 'Organizing sports events and fitness programs' },
  { email: 'alumni@clubs.iiit.ac.in', organizerName: 'Student Alumni Connect Cell', category: 'other', description: 'Connecting current students with alumni' },
  { email: 'parliament@clubs.iiit.ac.in', organizerName: 'Student Parliament', category: 'other', description: 'Student governance and representation' },
  { email: 'leanin@clubs.iiit.ac.in', organizerName: 'LeanIn Chapter IIITH', category: 'other', description: 'Empowering women in tech' },
  { email: 'queerclub@clubs.iiit.ac.in', organizerName: 'Students Queer Club', category: 'other', description: 'We\'re Here, We\'re Queer' },

  // ─── Fest-level organizers ───
  { email: 'felicity@felicity.iiit.ac.in', organizerName: 'Felicity', category: 'cultural', description: 'IIIT Hyderabad\'s largest and most vibrant annual fest. Felicity 2026 — The Disco Edition. Bringing together students from across the country for a celebration of culture, creativity, and community.' },
  { email: 'infinium@felicity.iiit.ac.in', organizerName: 'Infinium', category: 'technical', description: 'IIIT Hyderabad\'s Premiere Tech Fest. Born in 2025, the ultimate convergence of code, culture, and creativity. 1,500+ Participants, 30+ Events, 5 Lakh+ Prize Pool, 50+ Colleges.' },
];

// ═══════════════════════════════════════════════════
// ALL EVENTS (from felicity.iiit.ac.in/events)
// ═══════════════════════════════════════════════════
const ALL_EVENTS = [
  // ─── Feb 13 ───
  { name: 'Midnight AV Quiz', description: 'A fun late-night audio-visual quiz that tests your knowledge of music, movies, TV shows and pop culture. Bring your team and compete!', eventType: 'normal', eligibility: 'all', venue: 'H105', registrationDeadline: d(12,23), eventStartDate: d(13,0,0), eventEndDate: d(13,3,0), registrationLimit: 150, registrationFee: 0, status: 'published', tags: ['quiz','nightlife','av','trivia'], _orgName: 'The TV Room Quiz Club (TVRQC)' },
  { name: 'Royal Rumble', description: 'A grand chess tournament with multiple rounds — blitz, rapid and classical formats. Open to all skill levels.', eventType: 'normal', eligibility: 'all', venue: 'Himalaya 2nd Floor', registrationDeadline: d(12,23), eventStartDate: d(13,9,0), eventEndDate: d(13,17,0), registrationLimit: 64, registrationFee: 0, status: 'published', tags: ['chess','tournament','strategy'], _orgName: 'Chess Club' },
  { name: 'IIIT MUN', description: 'Model United Nations — simulate UN committees, debate global issues, draft resolutions and practice diplomacy.', eventType: 'normal', eligibility: 'iiit-only', venue: 'KRB Auditorium', registrationDeadline: d(12,18), eventStartDate: d(13,9,0), eventEndDate: d(13,17,0), registrationLimit: 200, registrationFee: 100, status: 'published', tags: ['mun','debate','diplomacy'], _orgName: 'DebSoc' },
  { name: 'Pic-a-Boo', description: 'A quirky photo challenge — solve clues, find locations on campus and snap the perfect picture before time runs out!', eventType: 'normal', eligibility: 'all', venue: 'H205', registrationDeadline: d(12,23), eventStartDate: d(13,11,0), eventEndDate: d(13,13,30), registrationLimit: 80, registrationFee: 0, status: 'published', tags: ['photography','fun','challenge'], _orgName: 'Pentaprism' },
  { name: 'Blitzball', description: 'An action-packed, fast-paced ball sport event on the football ground. Teams compete in quick rounds of high-energy play.', eventType: 'normal', eligibility: 'non-iiit-only', venue: 'Football Ground (Half Court)', registrationDeadline: d(12,23), eventStartDate: d(13,11,0), eventEndDate: d(13,18,0), registrationLimit: 120, registrationFee: 0, status: 'published', tags: ['sports','ball','team'], _orgName: 'Amateur Sports Enthusiasts Club (ASEC)' },
  { name: 'Zest', description: 'Dance Club\'s signature event — dance battles, flash mobs and freestyle sessions at the Warehouse.', eventType: 'normal', eligibility: 'all', venue: 'Warehouse', registrationDeadline: d(12,23), eventStartDate: d(13,14,0), eventEndDate: d(13,17,0), registrationLimit: 150, registrationFee: 0, status: 'published', tags: ['dance','zest','battle'], _orgName: 'Dance Club' },
  { name: 'Treasure Hunt', description: 'A campus-wide treasure hunt with cryptic clues, puzzles and hidden checkpoints. Race against other teams to find the treasure!', eventType: 'normal', eligibility: 'all', venue: 'H105', registrationDeadline: d(12,23), eventStartDate: d(13,14,0), eventEndDate: d(13,17,0), registrationLimit: 100, registrationFee: 0, status: 'published', tags: ['treasure','puzzle','adventure'], _orgName: 'Literary Club' },
  { name: 'Zest Dance Competition', description: 'The flagship dance competition of Felicity! Solo and group performances across genres — contemporary, classical, hip-hop, freestyle and more.', eventType: 'normal', eligibility: 'all', venue: 'Main Stage, Felicity Ground', registrationDeadline: d(12,23), eventStartDate: d(13,15,0), eventEndDate: d(13,18,30), registrationLimit: 200, registrationFee: 50, status: 'published', tags: ['dance','competition','cultural','zest'], _orgName: 'Felicity' },
  { name: 'Spray Painting', description: 'Express yourself with spray paint! Create graffiti-style art on large canvases. All materials provided.', eventType: 'normal', eligibility: 'all', venue: 'Kadamba Road', registrationDeadline: d(12,23), eventStartDate: d(13,16,0), eventEndDate: d(13,19,0), registrationLimit: 60, registrationFee: 30, status: 'published', tags: ['art','painting','graffiti','creative'], _orgName: 'Artsoc' },
  { name: 'Dance Inaugurals', description: 'The grand opening dance performance by Dance Club members — a spectacular showcase to kick off Felicity!', eventType: 'normal', eligibility: 'all', venue: 'Main Stage, Felicity Ground', registrationDeadline: d(13,17), eventStartDate: d(13,18,30), eventEndDate: d(13,21,0), registrationLimit: 500, registrationFee: 0, status: 'published', tags: ['dance','inaugurals','performance'], _orgName: 'Felicity' },
  { name: 'DJ Night', description: 'The ultimate party to close out Day 1! Live DJ set with lights, lasers and non-stop music.', eventType: 'normal', eligibility: 'all', venue: 'Main Stage, Felicity Ground', registrationDeadline: d(13,20), eventStartDate: d(13,21,0), eventEndDate: d(13,23,0), registrationLimit: 1000, registrationFee: 0, status: 'published', tags: ['dj','party','music','nightlife'], _orgName: 'Felicity' },
  { name: 'Co-opium', description: 'A cooperative gaming marathon — board games, card games, and co-op video games. Whole day drop-in event at Bakul Warehouse.', eventType: 'normal', eligibility: 'all', venue: 'Bakul Warehouse', registrationDeadline: d(12,23), eventStartDate: d(13,10,0), eventEndDate: d(13,22,0), registrationLimit: 200, registrationFee: 0, status: 'published', tags: ['gaming','coop','boardgames'], _orgName: 'The Gaming Club (TGC)' },
  { name: 'Jamming Session', description: 'A post-party open jam session — bring your instruments or just your voice. Chill vibes, great music.', eventType: 'normal', eligibility: 'all', venue: 'Felicity Ground', registrationDeadline: d(13,22), eventStartDate: d(13,23,0), eventEndDate: d(14,1,0), registrationLimit: 300, registrationFee: 0, status: 'published', tags: ['music','jam','live'], _orgName: 'Felicity' },

  // ─── Feb 14 ───
  { name: 'Photo Date', description: 'A photography walk and contest — capture the best moments of campus life and the fest through your lens.', eventType: 'normal', eligibility: 'all', venue: 'Warehouse', registrationDeadline: d(13,12), eventStartDate: d(14,16,0), eventEndDate: d(14,18,0), registrationLimit: 100, registrationFee: 0, status: 'published', tags: ['photography','art','contest'], _orgName: 'Pentaprism' },
  { name: 'Valentine\'s Day Open Mic', description: 'Share your poetry, songs or comedy on the open mic stage. A Valentine\'s Day celebration of expression.', eventType: 'normal', eligibility: 'all', venue: 'Felicity Ground', registrationDeadline: d(13,23), eventStartDate: d(14,18,0), eventEndDate: d(14,21,0), registrationLimit: 100, registrationFee: 0, status: 'published', tags: ['openmic','poetry','valentines'], _orgName: 'Literary Club' },
  { name: 'Hackathon: Code for Change', description: 'A 24-hour hackathon focused on social impact projects. Build solutions for real-world problems. 1,500+ Participants, 30+ Events, 5 Lakh+ Prize Pool, 50+ Colleges.', eventType: 'normal', eligibility: 'non-iiit-only', venue: 'T-Hub, IIITH', registrationDeadline: d(13,12), eventStartDate: d(14,9,0), eventEndDate: d(15,9,0), registrationLimit: 200, registrationFee: 0, status: 'published', tags: ['hackathon','coding','tech','innovation'], isTeamEvent: true, minTeamSize: 2, maxTeamSize: 4, _orgName: 'Infinium' },

  // ─── Feb 15 ───
  { name: 'Closing Ceremony & Awards', description: 'The grand closing ceremony of Felicity 2026. Award distribution, vote of thanks and farewell performances.', eventType: 'normal', eligibility: 'all', venue: 'Main Stage, Felicity Ground', registrationDeadline: d(15,12), eventStartDate: d(15,17,0), eventEndDate: d(15,20,0), registrationLimit: 1000, registrationFee: 0, status: 'published', tags: ['closing','awards','ceremony'], _orgName: 'Felicity' },
];

// ═══════════════════════════════════════════════════
// MERCHANDISE (from felicity.iiit.ac.in merch + dopamine store)
// ═══════════════════════════════════════════════════
const MERCH_EVENTS = [
  { name: 'DiscoGorgon T-Shirt', description: 'Official Felicity 2026 DiscoGorgon oversize T-shirt — premium 220 GSM cotton. Black with iconic DiscoGorgon artwork.', eventType: 'merchandise', eligibility: 'all', venue: 'Online + Felicity Stall', registrationDeadline: d(15,23), eventStartDate: d(10,0), eventEndDate: d(15,23), registrationLimit: 500, status: 'published', tags: ['merch','tshirt','discogorgon'], purchaseLimit: 3, variants: [
    { name: 'DiscoGorgon S', size: 'S', color: 'Black', price: 499, stock: 50, sold: 12 },
    { name: 'DiscoGorgon M', size: 'M', color: 'Black', price: 499, stock: 80, sold: 25 },
    { name: 'DiscoGorgon L', size: 'L', color: 'Black', price: 499, stock: 80, sold: 30 },
    { name: 'DiscoGorgon XL', size: 'XL', color: 'Black', price: 499, stock: 50, sold: 10 },
  ], _orgName: 'Felicity' },
  { name: 'Penguin T-Shirt', description: 'Felicity 2026 Penguin premium T-shirt — light blue with minimalist penguin artwork.', eventType: 'merchandise', eligibility: 'all', venue: 'Online + Felicity Stall', registrationDeadline: d(15,23), eventStartDate: d(10,0), eventEndDate: d(15,23), registrationLimit: 500, status: 'published', tags: ['merch','tshirt','penguin'], purchaseLimit: 3, variants: [
    { name: 'Penguin S', size: 'S', color: 'Light Blue', price: 399, stock: 40, sold: 8 },
    { name: 'Penguin M', size: 'M', color: 'Light Blue', price: 399, stock: 60, sold: 15 },
    { name: 'Penguin L', size: 'L', color: 'Light Blue', price: 399, stock: 60, sold: 20 },
    { name: 'Penguin XL', size: 'XL', color: 'Light Blue', price: 399, stock: 40, sold: 5 },
  ], _orgName: 'Felicity' },
  { name: 'Fried Maggie T-Shirt', description: 'Fried Maggie oversize T-shirt — premium 220 GSM. Brown with quirky Fried Maggie artwork.', eventType: 'merchandise', eligibility: 'all', venue: 'Online + Felicity Stall', registrationDeadline: d(15,23), eventStartDate: d(10,0), eventEndDate: d(15,23), registrationLimit: 500, status: 'published', tags: ['merch','tshirt','friedmaggie'], purchaseLimit: 3, variants: [
    { name: 'Fried Maggie S', size: 'S', color: 'Brown', price: 499, stock: 40, sold: 5 },
    { name: 'Fried Maggie M', size: 'M', color: 'Brown', price: 499, stock: 60, sold: 12 },
    { name: 'Fried Maggie L', size: 'L', color: 'Brown', price: 499, stock: 60, sold: 18 },
    { name: 'Fried Maggie XL', size: 'XL', color: 'Brown', price: 499, stock: 40, sold: 8 },
  ], _orgName: 'Felicity' },
  { name: 'Felicity 2026 T-Shirt', description: 'Classic Felicity 2026 logo T-shirt — bright design on premium fabric.', eventType: 'merchandise', eligibility: 'all', venue: 'Online + Felicity Stall', registrationDeadline: d(15,23), eventStartDate: d(10,0), eventEndDate: d(15,23), registrationLimit: 500, status: 'published', tags: ['merch','tshirt','felicity'], purchaseLimit: 3, variants: [
    { name: 'Felicity S', size: 'S', color: 'Multi', price: 299, stock: 50, sold: 10 },
    { name: 'Felicity M', size: 'M', color: 'Multi', price: 299, stock: 80, sold: 20 },
    { name: 'Felicity L', size: 'L', color: 'Multi', price: 299, stock: 80, sold: 25 },
    { name: 'Felicity XL', size: 'XL', color: 'Multi', price: 299, stock: 50, sold: 8 },
  ], _orgName: 'Felicity' },
  { name: 'Felicity Bundle (4 items)', description: 'Bundle of 4 Felicity merchandise items at a discounted price. Original ₹999, now ₹899.', eventType: 'merchandise', eligibility: 'all', venue: 'Online + Felicity Stall', registrationDeadline: d(15,23), eventStartDate: d(10,0), eventEndDate: d(15,23), registrationLimit: 200, status: 'published', tags: ['merch','bundle'], purchaseLimit: 2, variants: [
    { name: 'Bundle S', size: 'S', color: 'Mixed', price: 899, stock: 30, sold: 5 },
    { name: 'Bundle M', size: 'M', color: 'Mixed', price: 899, stock: 40, sold: 10 },
    { name: 'Bundle L', size: 'L', color: 'Mixed', price: 899, stock: 40, sold: 12 },
    { name: 'Bundle XL', size: 'XL', color: 'Mixed', price: 899, stock: 30, sold: 3 },
  ], _orgName: 'Felicity' },
  { name: 'Felicity Premium OZ Bundle', description: 'Premium oversize bundle — 2 premium tees at a special price. Original ₹900, now ₹875.', eventType: 'merchandise', eligibility: 'all', venue: 'Online + Felicity Stall', registrationDeadline: d(15,23), eventStartDate: d(10,0), eventEndDate: d(15,23), registrationLimit: 150, status: 'published', tags: ['merch','bundle','premium'], purchaseLimit: 2, variants: [
    { name: 'OZ Bundle S', size: 'S', color: 'Mixed', price: 875, stock: 20, sold: 3 },
    { name: 'OZ Bundle M', size: 'M', color: 'Mixed', price: 875, stock: 30, sold: 8 },
    { name: 'OZ Bundle L', size: 'L', color: 'Mixed', price: 875, stock: 30, sold: 10 },
    { name: 'OZ Bundle XL', size: 'XL', color: 'Mixed', price: 875, stock: 20, sold: 2 },
  ], _orgName: 'Felicity' },
  { name: 'Fried Maggie Tote Bag', description: 'Premium tote bag with Fried Maggie artwork. Durable canvas, perfect for everyday use. Original ₹349, now ₹229.', eventType: 'merchandise', eligibility: 'all', venue: 'Online + Felicity Stall', registrationDeadline: d(15,23), eventStartDate: d(10,0), eventEndDate: d(15,23), registrationLimit: 300, status: 'published', tags: ['merch','tote','bag','friedmaggie'], purchaseLimit: 5, variants: [
    { name: 'Tote Bag', size: 'One Size', color: 'Cream', price: 229, stock: 100, sold: 15 },
  ], _orgName: 'Felicity' },
];

// ═══════════════════════════════════════════════════
// DEMO PARTICIPANTS
// ═══════════════════════════════════════════════════
const DEMO_PARTICIPANTS = [
  { email: 'student1@students.iiit.ac.in', password: 'Student@123', firstName: 'Aarav', lastName: 'Sharma', participantType: 'iiit', collegeName: 'IIIT Hyderabad', role: 'participant', onboardingCompleted: true, interests: ['dance','music','quiz'] },
  { email: 'student2@students.iiit.ac.in', password: 'Student@123', firstName: 'Priya', lastName: 'Reddy', participantType: 'iiit', collegeName: 'IIIT Hyderabad', role: 'participant', onboardingCompleted: true, interests: ['photography','art','gaming'] },
  { email: 'student3@research.iiit.ac.in', password: 'Student@123', firstName: 'Karthik', lastName: 'Iyer', participantType: 'iiit', collegeName: 'IIIT Hyderabad', role: 'participant', onboardingCompleted: true, interests: ['hackathon','coding','chess'] },
  { email: 'faculty1@iiit.ac.in', password: 'Faculty@123', firstName: 'Dr. Ramesh', lastName: 'Kumar', participantType: 'iiit', collegeName: 'IIIT Hyderabad', role: 'participant', onboardingCompleted: true, interests: ['quiz','debate'] },
  { email: 'visitor1@gmail.com', password: 'Visitor@123', firstName: 'Rahul', lastName: 'Gupta', participantType: 'non-iiit', collegeName: 'IIT Bombay', role: 'participant', onboardingCompleted: true, interests: ['dance','music'] },
  { email: 'visitor2@gmail.com', password: 'Visitor@123', firstName: 'Sneha', lastName: 'Patil', participantType: 'non-iiit', collegeName: 'BITS Pilani', role: 'participant', onboardingCompleted: true, interests: ['quiz','debate'] },
  { email: 'visitor3@yahoo.com', password: 'Visitor@123', firstName: 'Amit', lastName: 'Singh', participantType: 'non-iiit', collegeName: 'NIT Warangal', role: 'participant', onboardingCompleted: true, interests: ['hackathon','sports'] },
];

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Clear old data (keep admin)
    console.log('\n🗑️  Clearing old organizers, participants, and events...');
    await User.deleteMany({ role: { $in: ['organizer','participant'] } });
    await Event.deleteMany({});
    console.log('   Done.');

    // 2. Create organizers
    console.log('\n📋 Creating ' + ALL_ORGANIZERS.length + ' organizers/clubs...');
    const orgMap = {};
    for (const o of ALL_ORGANIZERS) {
      const doc = await User.create({ ...o, password: 'Organizer@123', role: 'organizer', isActive: true });
      orgMap[o.organizerName] = doc._id;
      process.stdout.write('.');
    }
    console.log('\n   ✅ Organizers created.');

    // 3. Create normal events
    console.log('\n🎉 Creating ' + ALL_EVENTS.length + ' events...');
    for (const ev of ALL_EVENTS) {
      const orgId = orgMap[ev._orgName];
      if (!orgId) { console.warn('   ⚠️  Org "' + ev._orgName + '" not found, skipping "' + ev.name + '"'); continue; }
      const { _orgName, ...data } = ev;
      await Event.create({ ...data, organizer: orgId });
      process.stdout.write('.');
    }
    console.log('\n   ✅ Events created.');

    // 4. Create merchandise
    console.log('\n🛍️  Creating ' + MERCH_EVENTS.length + ' merchandise items...');
    for (const me of MERCH_EVENTS) {
      const orgId = orgMap[me._orgName];
      if (!orgId) { console.warn('   ⚠️  Org "' + me._orgName + '" not found, skipping "' + me.name + '"'); continue; }
      const { _orgName, ...data } = me;
      await Event.create({ ...data, organizer: orgId });
      process.stdout.write('.');
    }
    console.log('\n   ✅ Merchandise created.');

    // 5. Create demo participants
    console.log('\n👤 Creating ' + DEMO_PARTICIPANTS.length + ' demo participants...');
    for (const p of DEMO_PARTICIPANTS) {
      await User.create(p);
      process.stdout.write('.');
    }
    console.log('\n   ✅ Participants created.');

    // Summary
    const orgCount = await User.countDocuments({ role: 'organizer' });
    const partCount = await User.countDocuments({ role: 'participant' });
    const evCount = await Event.countDocuments({ eventType: 'normal' });
    const mCount = await Event.countDocuments({ eventType: 'merchandise' });

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║       📊 Database Population Summary       ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log('║  Organizers/Clubs : ' + String(orgCount).padStart(3) + '                   ║');
    console.log('║  Participants     : ' + String(partCount).padStart(3) + '                   ║');
    console.log('║  Normal Events    : ' + String(evCount).padStart(3) + '                   ║');
    console.log('║  Merchandise      : ' + String(mCount).padStart(3) + '                   ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('\n🔑 Demo credentials:');
    console.log('   Admin:        admin@felicity.iiit.ac.in  / Admin@123');
    console.log('   Organizers:   <any org email>            / Organizer@123');
    console.log('   IIIT Student: student1@students.iiit.ac.in / Student@123');
    console.log('   Faculty:      faculty1@iiit.ac.in        / Faculty@123');
    console.log('   Non-IIIT:     visitor1@gmail.com         / Visitor@123');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  }
};

run();
