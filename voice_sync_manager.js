/**
 * ═══════════════════════════════════════════════════════════════════
 * VOICE LIBRARY AUTO-SYNC MANAGER
 * ចម្លង និងគ្រប់គ្រងសំឡេងពី voice_split_tool ទៅ Voice Library
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, 'voice_split_tool');
const LIBRARY_DIR = path.join(__dirname, 'uploads', 'voice_samples');
const DB_DIR = path.join(__dirname, 'db');
const VOICE_DB = path.join(DB_DIR, 'voice_library.json');

/**
 * ═══════════════════════════════════════════════════════════════════
 * 1. FILE SYNC - ចម្លងឯកសារ
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * ចម្លងឯកសារ voice ទាំងអស់
 */
function syncVoiceFiles() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🎙️ VOICE LIBRARY SYNC - កំពុងចម្លងសំឡេង...');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Create directories if not exist
  if (!fs.existsSync(LIBRARY_DIR)) {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
    console.log('✅ បង្កើត folder:', LIBRARY_DIR);
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log('✅ បង្កើត folder:', DB_DIR);
  }

  // Check source directory
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('❌ មិនមាន folder:', SOURCE_DIR);
    return { copied: 0, skipped: 0, errors: 0 };
  }

  // Scan source files
  const sourceFiles = fs.readdirSync(SOURCE_DIR)
    .filter(f => /\.(mp3|wav)$/i.test(f));

  console.log(`📂 ស្កេនឃើញ ${sourceFiles.length} files ក្នុង voice_split_tool\n`);

  if (sourceFiles.length === 0) {
    console.log('⚠️ មិនមានឯកសារសំឡេងនៅក្នុង voice_split_tool');
    return { copied: 0, skipped: 0, errors: 0 };
  }

  let copied = 0;
  let skipped = 0;
  let errors = 0;

  sourceFiles.forEach((filename, index) => {
    const sourcePath = path.join(SOURCE_DIR, filename);
    const destPath = path.join(LIBRARY_DIR, filename);

    try {
      // Check if already exists
      if (fs.existsSync(destPath)) {
        const sourceStats = fs.statSync(sourcePath);
        const destStats = fs.statSync(destPath);

        // Skip if same size (assume same file)
        if (sourceStats.size === destStats.size) {
          console.log(`⏭️  [${index + 1}/${sourceFiles.length}] រំលង (មានរួចហើយ): ${filename}`);
          skipped++;
          return;
        }
      }

      // Copy file
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ [${index + 1}/${sourceFiles.length}] ចម្លងបានសម្រេច: ${filename}`);
      copied++;
    } catch (err) {
      console.error(`❌ [${index + 1}/${sourceFiles.length}] មិនបានសម្រេច: ${filename}`, err.message);
      errors++;
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`📊 សង្ខេប:`);
  console.log(`   ✅ ចម្លងបាន: ${copied} files`);
  console.log(`   ⏭️  រំលង: ${skipped} files`);
  console.log(`   ❌ កំហុស: ${errors} files`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  return { copied, skipped, errors };
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * 2. DATABASE SYNC - បង្កើត metadata
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * វិភាគប្រភេទតួអង្គពីឈ្មោះឯកសារ
 */
function detectCharacterType(filename) {
  const lower = filename.toLowerCase();

  // Male keywords
  if (lower.includes('male') || lower.includes('boy') || lower.includes('man') || lower.includes('vid')) {
    if (lower.includes('lead') || lower.includes('main')) return { type: 'ឯកប្រុស', gender: 'male' };
    if (lower.includes('child') || lower.includes('kid')) return { type: 'ក្មេងប្រុស', gender: 'male' };
    if (lower.includes('old') || lower.includes('elder')) return { type: 'ចាស់', gender: 'male' };
    if (lower.includes('villain') || lower.includes('bad')) return { type: 'កាច', gender: 'male' };
    if (lower.includes('general') || lower.includes('commander')) return { type: 'មេទ័ព', gender: 'male' };
    return { type: 'ឯកប្រុស', gender: 'male' };
  }

  // Female keywords
  if (lower.includes('female') || lower.includes('girl') || lower.includes('woman') || lower.includes('vp_character')) {
    if (lower.includes('lead') || lower.includes('main')) return { type: 'ឯកស្រី', gender: 'female' };
    if (lower.includes('child') || lower.includes('kid')) return { type: 'ក្មេងស្រី', gender: 'female' };
    if (lower.includes('old') || lower.includes('elder')) return { type: 'ចាស់', gender: 'female' };
    return { type: 'ឯកស្រី', gender: 'female' };
  }

  // Number-based detection
  const numMatch = filename.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0]);
    // Odd = male, Even = female
    return (num % 2 === 1) 
      ? { type: 'ឯកប្រុស', gender: 'male' }
      : { type: 'ឯកស្រី', gender: 'female' };
  }

  // Default
  return { type: 'ឯកប្រុស', gender: 'male' };
}

/**
 * បង្កើន metadata database
 */
function updateVoiceDatabase() {
  console.log('🗄️  កំពុងបង្កើន Voice Library Database...\n');

  // Load existing database
  let db = { voices: [], lastUpdated: null };
  if (fs.existsSync(VOICE_DB)) {
    try {
      db = JSON.parse(fs.readFileSync(VOICE_DB, 'utf8'));
      console.log(`📖 ផ្ទុក database (មាន ${db.voices.length} voices)\n`);
    } catch (err) {
      console.error('⚠️ Database មិនអាចអាន, បង្កើតថ្មី...');
      db = { voices: [], lastUpdated: null };
    }
  }

  // Scan library directory
  const libraryFiles = fs.readdirSync(LIBRARY_DIR)
    .filter(f => /\.(mp3|wav)$/i.test(f));

  console.log(`📂 ស្កេនឃើញ ${libraryFiles.length} files ក្នុង voice library\n`);

  let added = 0;
  let updated = 0;

  libraryFiles.forEach((filename, index) => {
    const filepath = path.join(LIBRARY_DIR, filename);
    const stats = fs.statSync(filepath);

    // Check if already in database
    let existingVoice = db.voices.find(v => v.filename === filename);

    if (existingVoice) {
      // Update if file changed
      if (existingVoice.fileSize !== stats.size) {
        existingVoice.fileSize = stats.size;
        existingVoice.lastModified = stats.mtime.toISOString();
        console.log(`🔄 [${index + 1}/${libraryFiles.length}] បន្ទាន់សម័យ: ${filename}`);
        updated++;
      }
    } else {
      // Add new entry
      const detection = detectCharacterType(filename);
      const newVoice = {
        id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        filename: filename,
        name: filename.replace(/\.(mp3|wav)$/i, ''),
        filepath: filepath,
        characterType: detection.type,
        gender: detection.gender,
        fileSize: stats.size,
        format: path.extname(filename).toLowerCase().replace('.', ''),
        dateAdded: new Date().toISOString(),
        lastModified: stats.mtime.toISOString(),
        isActive: true
      };

      db.voices.push(newVoice);
      console.log(`➕ [${index + 1}/${libraryFiles.length}] បន្ថែម: ${filename} → ${detection.type} (${detection.gender})`);
      added++;
    }
  });

  // Update timestamp
  db.lastUpdated = new Date().toISOString();
  db.totalVoices = db.voices.length;

  // Save database
  fs.writeFileSync(VOICE_DB, JSON.stringify(db, null, 2), 'utf8');

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`📊 Database បានបង្កើនសម័យ:`);
  console.log(`   ➕ បន្ថែមថ្មី: ${added} voices`);
  console.log(`   🔄 បន្ទាន់សម័យ: ${updated} voices`);
  console.log(`   📚 សរុប: ${db.totalVoices} voices`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  return { added, updated, total: db.totalVoices };
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * 3. MAIN SYNC FUNCTION
 * ═══════════════════════════════════════════════════════════════════
 */

function syncVoiceLibrary() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║         🎙️  VOICE LIBRARY AUTO-SYNC MANAGER 🎙️                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Step 1: Sync files
  const syncResult = syncVoiceFiles();

  // Step 2: Update database
  const dbResult = updateVoiceDatabase();

  // Final summary
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                     ✅ រួចរាល់ទាំងអស់!                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n📋 សង្ខេបចុងក្រោយ:');
  console.log(`   • ឯកសារចម្លង: ${syncResult.copied}`);
  console.log(`   • ឯកសាររំលង: ${syncResult.skipped}`);
  console.log(`   • Voices បន្ថែម: ${dbResult.added}`);
  console.log(`   • Voices សរុប: ${dbResult.total}`);
  console.log('\n🎯 ត្រៀមរួចសម្រាប់ voice cloning ក្នុង dubbing pipeline!\n');

  return {
    sync: syncResult,
    database: dbResult
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * 4. API ENDPOINTS (for server.js)
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Get all voices from database
 */
function getAllVoices() {
  if (!fs.existsSync(VOICE_DB)) {
    return [];
  }

  try {
    const db = JSON.parse(fs.readFileSync(VOICE_DB, 'utf8'));
    return db.voices || [];
  } catch (err) {
    console.error('Error reading voice database:', err);
    return [];
  }
}

/**
 * Get voice by ID
 */
function getVoiceById(voiceId) {
  const voices = getAllVoices();
  return voices.find(v => v.id === voiceId) || null;
}

/**
 * Get voices by character type
 */
function getVoicesByType(characterType) {
  const voices = getAllVoices();
  return voices.filter(v => v.characterType === characterType);
}

/**
 * Get voices by gender
 */
function getVoicesByGender(gender) {
  const voices = getAllVoices();
  return voices.filter(v => v.gender === gender);
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  syncVoiceLibrary,
  syncVoiceFiles,
  updateVoiceDatabase,
  getAllVoices,
  getVoiceById,
  getVoicesByType,
  getVoicesByGender,
  LIBRARY_DIR,
  VOICE_DB
};

// ═══════════════════════════════════════════════════════════════════
// CLI EXECUTION
// ═══════════════════════════════════════════════════════════════════

if (require.main === module) {
  syncVoiceLibrary();
}
