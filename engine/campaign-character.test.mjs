import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignCharacter,newCampaignProgression,resolveCharacterClass,classAttributes} from './character.mjs';
import {classStart,starts,treeStatus,allocate} from './passive-tree.mjs';
import {grantExperience} from './progression.mjs';

test('campaign creation binds Ranger equipment profile and passive root to the same character class',()=>{
 const p=newCampaignProgression();
 assert.equal(resolveCharacterClass(p),campaignCharacter.className);
 assert.equal(classStart(p),starts[campaignCharacter.className]);
 assert.deepEqual(classAttributes[resolveCharacterClass(p)],[14,32,14]);
 assert.deepEqual(campaignCharacter.starterGems,['burning-arrow','momentum']);
 const levelled={...grantExperience(p,100,()=>100),passiveClass:'Witch'};
 assert.equal(resolveCharacterClass(levelled),'Ranger');
 assert.equal(classStart(levelled),starts.Ranger);
 assert.equal(treeStatus(levelled).availability(starts.Witch).state,'locked');
 assert.throws(()=>allocate(levelled,starts.Witch),/其他職業/);
 assert.equal(allocate(levelled,39821).characterClass,'Ranger');
 assert.deepEqual(newCampaignProgression(),p);
});
