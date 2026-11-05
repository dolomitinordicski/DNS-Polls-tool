import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const contract = json('release/central-rules-contract.json');
const firebase = json(contract.firebaseConfig);
const emulator = json(contract.emulatorConfig);
const projects = json('.firebaserc');
const rules = readFileSync(contract.rulesFile, 'utf8');

assert.equal(contract.schemaVersion, 1, 'Unexpected central release contract version');
assert.equal(contract.repository, 'dolomitinordicski/DNS-Polls-tool');
assert.equal(contract.firebaseProject, 'dns-polls', 'Unexpected production project');
assert.equal(contract.rulesFile, 'firestore.rules', 'Unexpected rules source');
assert.equal(contract.firebaseConfig, 'firebase.json');
assert.equal(contract.emulatorConfig, 'firebase.emulator.json');
assert.equal(contract.deploymentTarget, 'firestore:rules');
assert.equal(projects.projects?.default, contract.firebaseProject);
assert.equal(firebase.firestore?.rules, contract.rulesFile, 'Deploy rules path drift');
assert.equal(emulator.firestore?.rules, contract.rulesFile, 'Emulator rules path drift');
assert.ok(rules.includes('rules_version'), 'Rules version missing');
assert.ok(rules.includes('service cloud.firestore'), 'Firestore rules service missing');
console.log('Polls central rules release contract preflight: PASS (offline, no credentials).');
