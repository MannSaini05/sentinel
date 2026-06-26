import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './schema.js';

/**
 * Seed the Sentinel database with demo data.
 * Run with: node server/db/seed.js
 */
async function seed() {
  console.log('🌱 Seeding Sentinel database...\n');

  const db = getDb();

  // Clear existing data (in reverse FK order)
  console.log('  Clearing existing data...');
  db.exec(`
    DELETE FROM alerts;
    DELETE FROM alert_rules;
    DELETE FROM usage_sessions;
    DELETE FROM screen_time_limits;
    DELETE FROM devices;
    DELETE FROM parent_child_links;
    DELETE FROM users;
  `);

  // ─── Users ────────────────────────────────────────────────────────────
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const parentId = uuidv4();
  const emmaId = uuidv4();
  const liamId = uuidv4();

  const users = [
    { id: parentId, email: 'parent@sentinel.app', name: 'Sarah Mitchell', role: 'parent', phone: '+1234567890', avatar_color: '#8b5cf6' },
    { id: emmaId, email: 'emma@sentinel.app', name: 'Emma Mitchell', role: 'child', phone: null, avatar_color: '#06b6d4' },
    { id: liamId, email: 'liam@sentinel.app', name: 'Liam Mitchell', role: 'child', phone: null, avatar_color: '#10b981' },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, phone, avatar_color, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const u of users) {
    insertUser.run(u.id, u.email, passwordHash, u.name, u.role, u.phone, u.avatar_color, now);
  }
  console.log(`  ✅ Created ${users.length} users`);

  // ─── Parent-Child Links ───────────────────────────────────────────────
  const insertLink = db.prepare(`
    INSERT INTO parent_child_links (id, parent_id, child_id, link_code, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertLink.run(uuidv4(), parentId, emmaId, 'EMMA01', now);
  insertLink.run(uuidv4(), parentId, liamId, 'LIAM01', now);
  console.log('  ✅ Linked parent to both children');

  // ─── Devices ──────────────────────────────────────────────────────────
  const emmaIpad = uuidv4();
  const emmaIphone = uuidv4();
  const liamMacbook = uuidv4();
  const liamAndroid = uuidv4();

  const devicesData = [
    { id: emmaIpad, child_id: emmaId, device_name: 'iPad', device_type: 'tablet', os: 'iPadOS' },
    { id: emmaIphone, child_id: emmaId, device_name: 'iPhone', device_type: 'phone', os: 'iOS' },
    { id: liamMacbook, child_id: liamId, device_name: 'MacBook', device_type: 'laptop', os: 'macOS' },
    { id: liamAndroid, child_id: liamId, device_name: 'Android Phone', device_type: 'phone', os: 'Android' },
  ];

  const insertDevice = db.prepare(`
    INSERT INTO devices (id, child_id, device_name, device_type, os, is_active, last_seen)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);

  for (const d of devicesData) {
    insertDevice.run(d.id, d.child_id, d.device_name, d.device_type, d.os, now);
  }
  console.log(`  ✅ Created ${devicesData.length} devices`);

  // ─── Usage Session Generation ─────────────────────────────────────────
  const APP_DATA = {
    'Social Media': { apps: ['TikTok', 'Instagram', 'Snapchat'], morningWeight: 0.05, afternoonWeight: 0.25, eveningWeight: 0.35, minDur: 10, maxDur: 45 },
    'Gaming': { apps: ['Roblox', 'Minecraft', 'Fortnite'], morningWeight: 0.05, afternoonWeight: 0.15, eveningWeight: 0.35, minDur: 15, maxDur: 60 },
    'Education': { apps: ['Khan Academy', 'Duolingo', 'Google Classroom'], morningWeight: 0.40, afternoonWeight: 0.15, eveningWeight: 0.05, minDur: 10, maxDur: 45 },
    'Entertainment': { apps: ['YouTube', 'Netflix', 'Disney+'], morningWeight: 0.10, afternoonWeight: 0.20, eveningWeight: 0.30, minDur: 15, maxDur: 90 },
    'Productivity': { apps: ['Google Docs', 'Notion'], morningWeight: 0.25, afternoonWeight: 0.15, eveningWeight: 0.05, minDur: 10, maxDur: 30 },
    'Communication': { apps: ['WhatsApp', 'iMessage'], morningWeight: 0.25, afternoonWeight: 0.10, eveningWeight: 0.05, minDur: 5, maxDur: 20 },
  };

  const categories = Object.keys(APP_DATA);

  function pickCategory(period) {
    const weights = categories.map(cat => {
      const d = APP_DATA[cat];
      if (period === 'morning') return d.morningWeight;
      if (period === 'afternoon') return d.afternoonWeight;
      return d.eveningWeight;
    });
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < categories.length; i++) {
      r -= weights[i];
      if (r <= 0) return categories[i];
    }
    return categories[categories.length - 1];
  }

  function pickApp(category) {
    const apps = APP_DATA[category].apps;
    return apps[Math.floor(Math.random() * apps.length)];
  }

  function randomDuration(category) {
    const { minDur, maxDur } = APP_DATA[category];
    return Math.round((Math.random() * (maxDur - minDur) + minDur) * 100) / 100;
  }

  const insertSession = db.prepare(`
    INSERT INTO usage_sessions (id, child_id, device_id, app_category, app_name, start_time, end_time, duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const childConfigs = [
    { id: emmaId, name: 'Emma', devices: [emmaIpad, emmaIphone], targetAvgMinutes: 150 },
    { id: liamId, name: 'Liam', devices: [liamMacbook, liamAndroid], targetAvgMinutes: 210 },
  ];

  let totalSessions = 0;

  const insertManyTransaction = db.transaction(() => {
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const day = new Date();
      day.setDate(day.getDate() - dayOffset);

      for (const child of childConfigs) {
        // Generate 8-15 sessions per day per child
        const sessionCount = Math.floor(Math.random() * 8) + 8;
        let dailyTotal = 0;
        const targetForDay = child.targetAvgMinutes + (Math.random() * 60 - 30); // ±30 min variance

        for (let s = 0; s < sessionCount; s++) {
          // Determine time period and hour
          let period, hourBase;
          const periodRoll = Math.random();
          if (periodRoll < 0.25) {
            period = 'morning';
            hourBase = 7 + Math.floor(Math.random() * 5); // 7-11
          } else if (periodRoll < 0.6) {
            period = 'afternoon';
            hourBase = 12 + Math.floor(Math.random() * 5); // 12-16
          } else {
            period = 'evening';
            hourBase = 17 + Math.floor(Math.random() * 5); // 17-21
          }

          const category = pickCategory(period);
          const appName = pickApp(category);
          let duration = randomDuration(category);

          // Scale duration to get closer to target daily total
          const remainingSessions = sessionCount - s;
          const remainingTarget = targetForDay - dailyTotal;
          if (remainingSessions > 0) {
            const idealPerSession = remainingTarget / remainingSessions;
            // Blend actual duration with ideal to control total
            duration = Math.max(5, (duration + idealPerSession) / 2);
            duration = Math.round(duration * 100) / 100;
          }

          dailyTotal += duration;

          const minute = Math.floor(Math.random() * 60);
          const startTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hourBase, minute, 0);
          const endTime = new Date(startTime.getTime() + duration * 60000);

          const deviceId = child.devices[Math.floor(Math.random() * child.devices.length)];

          insertSession.run(
            uuidv4(),
            child.id,
            deviceId,
            category,
            appName,
            startTime.toISOString(),
            endTime.toISOString(),
            duration
          );

          totalSessions++;
        }
      }
    }
  });

  insertManyTransaction();
  console.log(`  ✅ Generated ${totalSessions} usage sessions (7 days)`);

  // ─── Screen Time Limits ───────────────────────────────────────────────
  const insertLimit = db.prepare(`
    INSERT INTO screen_time_limits (id, child_id, daily_limit_minutes, per_app_limit_minutes, category, set_by_parent_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertLimit.run(uuidv4(), emmaId, 120, 60, null, parentId);
  insertLimit.run(uuidv4(), liamId, 180, 90, null, parentId);
  console.log('  ✅ Set screen time limits (Emma: 120min, Liam: 180min)');

  // ─── Alert Rules ──────────────────────────────────────────────────────
  const insertRule = db.prepare(`
    INSERT INTO alert_rules (id, parent_id, child_id, threshold_minutes, cooldown_minutes, is_active, notify_email, notify_sms)
    VALUES (?, ?, ?, ?, ?, 1, 1, 0)
  `);

  // Emma: warning at 80% (96 min), exceeded at 100% (120 min)
  insertRule.run(uuidv4(), parentId, emmaId, 96, 30);
  insertRule.run(uuidv4(), parentId, emmaId, 120, 30);

  // Liam: warning at 80% (144 min), exceeded at 100% (180 min)
  insertRule.run(uuidv4(), parentId, liamId, 144, 30);
  insertRule.run(uuidv4(), parentId, liamId, 180, 30);
  console.log('  ✅ Created alert rules (80% warning, 100% exceeded for each child)');

  // ─── Sample Alerts ────────────────────────────────────────────────────
  const insertAlert = db.prepare(`
    INSERT INTO alerts (id, parent_id, child_id, type, message, is_read, delivered_email, delivered_sms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)
  `);

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  insertAlert.run(
    uuidv4(), parentId, emmaId, 'warning',
    'Emma Mitchell is approaching their screen time limit. Current usage: 98 minutes of 120-minute daily limit (82%).',
    1, twoDaysAgo.toISOString()
  );
  insertAlert.run(
    uuidv4(), parentId, emmaId, 'exceeded',
    'Emma Mitchell has exceeded their daily screen time limit. Current usage: 135 minutes (limit: 120 minutes).',
    1, twoDaysAgo.toISOString()
  );
  insertAlert.run(
    uuidv4(), parentId, liamId, 'warning',
    'Liam Mitchell is approaching their screen time limit. Current usage: 150 minutes of 180-minute daily limit (83%).',
    0, oneDayAgo.toISOString()
  );
  insertAlert.run(
    uuidv4(), parentId, liamId, 'exceeded',
    'Liam Mitchell has exceeded their daily screen time limit. Current usage: 195 minutes (limit: 180 minutes).',
    0, oneDayAgo.toISOString()
  );
  console.log('  ✅ Created 4 sample alerts');

  // ─── Summary ──────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────');
  console.log('📊 Seed Summary:');
  console.log('─────────────────────────────────────────────');
  console.log(`  Users:        ${users.length} (1 parent, 2 children)`);
  console.log(`  Devices:      ${devicesData.length}`);
  console.log(`  Sessions:     ${totalSessions}`);
  console.log(`  Limits:       2`);
  console.log(`  Alert Rules:  4`);
  console.log(`  Alerts:       4`);
  console.log('─────────────────────────────────────────────');
  console.log('\n🔑 Login Credentials:');
  console.log('  Parent: parent@sentinel.app / password123');
  console.log('  Child:  emma@sentinel.app   / password123');
  console.log('  Child:  liam@sentinel.app   / password123');
  console.log('\n✅ Seeding complete!\n');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
