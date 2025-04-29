# Example Status Scenarios and Outputs

This document shows example user inputs and how they would be processed by the AI system to create status updates in Discord.

## Scenario 1: Gaming Availability

### User Input
```
Just finished my work for the day and feeling pretty good. I'm up for some gaming tonight - particularly looking for a Valorant squad or maybe some Minecraft building. I'll be around until about midnight, and I'm in a voice chat mood too!
```

### LLM Processing Output (Example - Actual output may vary)
```json
{
  "overall_status": "Ready for Gaming",
  "mood_emoji": "🎮",
  "visual_theme": "gaming",
  "accent_color": "#9c59b6",
  "metrics": {
    { "name": "Energy", "value": "Good", "value_rating": 4, "trend": "new", "icon": "⚡" },
    { "name": "Focus", "value": "High", "value_rating": 4, "trend": "new", "icon": "🧠" },
    { "name": "Availability", "value": "High", "value_rating": 5, "trend": "new", "icon": "✅" },
    { "name": "Social Capacity", "value": "Ready", "value_rating": 5, "trend": "new", "icon": "🗣️" }
  ],
  "highlights": [
    { "type": "event", "description": "Finished work for the day", "timeframe": "past", "is_new": true },
    { "type": "activity", "description": "Looking for Valorant squad", "timeframe": "current", "is_new": true },
    { "type": "activity", "description": "Might play Minecraft building", "timeframe": "future", "is_new": true },
    { "type": "state", "description": "Available until midnight", "timeframe": "current", "is_new": true },
    { "type": "preference", "description": "Prefers voice chat", "timeframe": "current", "is_new": true }
  ],
  "persistent_context": [],
  "personal_states": [],
  "narrative_summary": "Finished work and feeling good, ready for some Valorant or Minecraft gaming tonight until midnight. Prefers voice chat.",
  "errors": []
}
```

### Discord Display (Example - Actual appearance depends on theme/data)
```
🎮 🎮 ━━━━ GAMING ━━━━
<@USER_ID>'s Status: **Ready for Gaming**
*Updated: <t:TIMESTAMP:R>*

⚡ Energy: ✨ ██████████ (4/5)
*Value: Good*
🧠 Focus: ✨ ██████████ (4/5)
*Value: High*
✅ Availability: ✨ ██████████ (5/5)
*Value: High*
🗣️ Social Capacity: ✨ ██████████ (5/5)
*Value: Ready*
━━━━━━━━━━━━━━━━━━━━
💡 Highlights
✨ 📅 Finished work for the day (past)
✨ 🏃 Looking for Valorant squad (current)
✨ 🏃 Might play Minecraft building (future)
✨ 💭 Available until midnight (current)
✨ 📌 Prefers voice chat (current)
━━━━━━━━━━━━━━━━━━━━
📝 Summary
Finished work and feeling good, ready for some Valorant or Minecraft gaming tonight until midnight. Prefers voice chat.
```
*(Components like buttons/select menu would also appear below)*

## Scenario 2: Busy Work Day

### User Input
```
Crazy day at work. In back-to-back meetings until 5pm, then have a deadline to hit by EOD. Low energy and not really able to chat much. Will probably be offline most of the evening too as I need to recharge. Rain check on our usual Tuesday game night?
```

### LLM Processing Output (Example)
```json
{
  "overall_status": "Busy with Work Deadline",
  "mood_emoji": "💼",
  "visual_theme": "work",
  "accent_color": "#E67E22",
  "metrics": {
    { "name": "Energy", "value": "Low", "value_rating": 2, "trend": "new", "icon": "⚡" },
    { "name": "Focus", "value": "On Deadline", "value_rating": 3, "trend": "new", "icon": "🎯" },
    { "name": "Availability", "value": "Very Low", "value_rating": 1, "trend": "new", "icon": "⛔" },
    { "name": "Social Capacity", "value": "None", "value_rating": 1, "trend": "new", "icon": "🔇" }
  ],
  "highlights": [
    { "type": "event", "description": "In back-to-back meetings until 5pm", "timeframe": "current", "is_new": true },
    { "type": "activity", "description": "Working on deadline by EOD", "timeframe": "current", "is_new": true },
    { "type": "state", "description": "Unavailable for game night", "timeframe": "future", "is_new": true },
    { "type": "need", "description": "Needs to recharge this evening", "timeframe": "future", "is_new": true }
  ],
  "persistent_context": [],
  "personal_states": [
    { "name": "Tiredness", "emoji": "😴", "level": 4, "time_since_last": "unknown", "trend": "new" }
  ],
  "narrative_summary": "Currently swamped with meetings until 5pm and a work deadline by EOD. Energy is low, availability is minimal. Unavailable for game night and needs to recharge tonight.",
  "errors": []
}
```

### Discord Display (Example)
```
💼 💼 ━━━━ WORKING ━━━━
<@USER_ID>'s Status: **Busy with Work Deadline**
*Updated: <t:TIMESTAMP:R>*

⚡ Energy: ✨ ████░░░░░░ (2/5)
*Value: Low*
🎯 Focus: ✨ ██████░░░░ (3/5)
*Value: On Deadline*
⛔ Availability: ✨ ██░░░░░░░░ (1/5)
*Value: Very Low*
🔇 Social Capacity: ✨ ██░░░░░░░░ (1/5)
*Value: None*
━━━━━━━━━━━━━━━━━━━━
💡 Highlights
✨ 📅 In back-to-back meetings until 5pm (current)
✨ 🏃 Working on deadline by EOD (current)
✨ 💭 Unavailable for game night (future)
✨ ❗ Needs to recharge this evening (future)
━━━━━━━━━━━━━━━━━━━━
🧬 Personal State
😴 **Tiredness:** ✨ ████████░░ (4/5) | Last: unknown
━━━━━━━━━━━━━━━━━━━━
📝 Summary
Currently swamped with meetings until 5pm and a work deadline by EOD. Energy is low, availability is minimal. Unavailable for game night and needs to recharge tonight.
```

## Scenario 3: Open to Hang Out

### User Input
```
Feeling pretty bored today. I've finished all my work early and have nothing planned until tomorrow. Would love to play some Elden Ring with friends if anyone's around. I'm a bit tired physically but mentally ready for some gaming. Don't feel like voice chat though, just text.
```

### LLM Processing Output (Example)
```json
{
  "overall_status": "Open for Elden Ring (Text Chat)",
  "mood_emoji": "🎮",
  "visual_theme": "gaming",
  "accent_color": "#95a5a6",
  "metrics": {
    { "name": "Energy", "value": "Low (Physical)", "value_rating": 2, "trend": "new", "icon": "⚡" },
    { "name": "Focus", "value": "Mentally Ready", "value_rating": 4, "trend": "new", "icon": "🧠" },
    { "name": "Availability", "value": "High", "value_rating": 5, "trend": "new", "icon": "✅" },
    { "name": "Social Capacity", "value": "Text Only", "value_rating": 3, "trend": "new", "icon": "💬" }
  ],
  "highlights": [
    { "type": "state", "description": "Feeling bored", "timeframe": "current", "is_new": true },
    { "type": "event", "description": "Finished work early", "timeframe": "past", "is_new": true },
    { "type": "activity", "description": "Wants to play Elden Ring with friends", "timeframe": "current", "is_new": true },
    { "type": "state", "description": "Physically tired", "timeframe": "current", "is_new": true },
    { "type": "preference", "description": "Prefers text chat, no voice", "timeframe": "current", "is_new": true }
  ],
  "persistent_context": [],
  "personal_states": [
    { "name": "Tiredness", "emoji": "😴", "level": 3, "time_since_last": "unknown", "trend": "new" }
  ],
  "narrative_summary": "Finished work early and feeling bored. Available to play Elden Ring with friends today, but physically tired and prefers text chat only.",
  "errors": []
}
```

### Discord Display (Example)
```
🎮 🎮 ━━━━ GAMING ━━━━
<@USER_ID>'s Status: **Open for Elden Ring (Text Chat)**
*Updated: <t:TIMESTAMP:R>*

⚡ Energy: ✨ ████░░░░░░ (2/5)
*Value: Low (Physical)*
🧠 Focus: ✨ ████████░░ (4/5)
*Value: Mentally Ready*
✅ Availability: ✨ ██████████ (5/5)
*Value: High*
💬 Social Capacity: ✨ ██████░░░░ (3/5)
*Value: Text Only*
━━━━━━━━━━━━━━━━━━━━
💡 Highlights
✨ 💭 Feeling bored (current)
✨ 📅 Finished work early (past)
✨ 🏃 Wants to play Elden Ring with friends (current)
✨ 💭 Physically tired (current)
✨ 📌 Prefers text chat, no voice (current)
━━━━━━━━━━━━━━━━━━━━
🧬 Personal State
😴 **Tiredness:** ✨ ██████░░░░ (3/5) | Last: unknown
━━━━━━━━━━━━━━━━━━━━
📝 Summary
Finished work early and feeling bored. Available to play Elden Ring with friends today, but physically tired and prefers text chat only.
```
