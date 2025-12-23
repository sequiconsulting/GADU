#!/usr/bin/env node
const firebaseTools = require('firebase-tools');

async function main() {
  const project = process.env.FIREBASE_PROJECT || 'gadu-staging';
  const token = process.env.FIREBASE_TOKEN;

  if (!token) {
    console.log('[deployRules] FIREBASE_TOKEN not set. Skipping automatic rules deploy.');
    console.log('Set FIREBASE_TOKEN (CI token) and rerun: npm run deploy:rules');
    process.exit(0);
  }

  try {
    console.log(`[deployRules] Deploying Firestore rules to project: ${project}`);
    await firebaseTools.deploy({
      only: 'firestore:rules',
      project,
      token,
      nonInteractive: true,
      force: true,
      cwd: process.cwd(),
    });
    console.log('[deployRules] Firestore rules deployed successfully.');
  } catch (err) {
    console.error('[deployRules] Failed to deploy Firestore rules:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

main();
