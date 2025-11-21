# Photo Categorization Schema

## Overview

This document defines the comprehensive tag schema for photo classification. The system uses five main categories with predefined tag lists to ensure consistency while allowing flexibility for unique characteristics.

## Design Principles

1. **Structured Categorization**: Tags organized into distinct categories for precise filtering
2. **Predefined Core Tags**: Consistent vocabulary for common attributes
3. **Extensibility**: LLM can generate new tags when needed
4. **Natural Language Support**: Enable future natural language queries
5. **User-Focused**: Tags designed for practical filtering needs

## Five Main Categories

### 1. Content Tags
**Purpose**: Identify what's physically in the photo

**Core Predefined Tags**:
```
Landscape & Nature:
- nature, mountains, hills, valley, canyon, cliff
- forest, woods, trees, jungle, rainforest
- beach, ocean, sea, water, lake, river, waterfall, pond
- desert, sand, dunes
- sky, clouds, sunrise, sunset, stars, milky_way
- snow, ice, glacier, winter_landscape
- flowers, plants, vegetation, garden
- wildlife, animals, birds, insects

Urban & Architecture:
- urban, city, cityscape, downtown
- architecture, building, skyscraper, tower
- street, road, highway, bridge, tunnel
- interior, room, indoor
- industrial, factory, warehouse
- historic, monument, landmark
- modern, contemporary, traditional

Objects & Activities:
- food, cuisine, meal, cooking
- technology, computer, phone, device
- vehicle, car, bike, motorcycle, airplane, boat
- sports, fitness, exercise
- art, painting, sculpture, graffiti
- music, instrument, concert
- fashion, clothing, accessories
- abstract, pattern, texture, geometric

Other:
- underwater, aerial, space
- macro, close_up, detail
- minimalist, empty, sparse
```

**Flexibility**: LLM can add tags like "volcanic_landscape", "neon_signs", "street_market", etc.

**Expected Count**: 2-5 tags per photo

---

### 2. People Tags
**Purpose**: Identify human presence and proximity

**Core Predefined Tags**:
```
Presence:
- no_people (REQUIRED if no people present)
- people (REQUIRED if people present)

Proximity (when people present):
- close (REQUIRED: portrait, within 1-2m, OR occupies >30% of frame)
- distant (REQUIRED: far from camera, small in frame)

Count:
- single (one person)
- couple (two people)
- small_group (3-5 people)
- group (6-15 people)
- crowd (>15 people)

Demographics (when clearly visible):
- man, woman, child, baby, elderly
- faces_visible, faces_hidden
- full_body, upper_body, profile

Activities:
- portrait, selfie
- interaction, conversation
- working, reading, relaxing
- walking, running, sitting, standing
- performing, presenting
```

**Special Rules**:
1. ALWAYS include either "no_people" OR "people"
2. If "people" is present, MUST add proximity: "close" OR "distant"
3. Proximity criteria (ANY ONE triggers "close"):
   - Portrait shots (face is main subject)
   - Person within 1-2 meters of camera
   - Person occupies more than 30% of frame area

**Expected Count**: 2-5 tags per photo

**Examples**:
- Solo hiker in distance: `["people", "distant", "single", "full_body"]`
- Face close-up: `["people", "close", "single", "portrait", "faces_visible", "woman"]`
- Empty landscape: `["no_people"]`
- Wedding party: `["people", "close", "group", "faces_visible"]`

---

### 3. Mood Tags
**Purpose**: Capture emotional atmosphere and feeling

**Core Predefined Tags**:
```
Positive:
- peaceful, serene, calm, tranquil, relaxing
- joyful, happy, cheerful, uplifting
- energetic, vibrant, dynamic, lively
- inspiring, motivational, hopeful
- romantic, intimate, tender
- playful, fun, whimsical

Neutral/Balanced:
- contemplative, reflective, thoughtful
- minimalist, simple, clean
- balanced, harmonious
- natural, organic, authentic

Dramatic/Intense:
- dramatic, powerful, intense
- mysterious, enigmatic, intriguing
- moody, atmospheric
- epic, grand, majestic
- bold, striking, impactful

Negative/Dark:
- melancholic, sad, lonely
- dark, gloomy, somber
- tense, anxious, uncomfortable
- desolate, abandoned, empty
```

**Flexibility**: LLM can add tags like "nostalgic", "surreal", "meditative", etc.

**Expected Count**: 2-4 tags per photo

**Notes**: 
- Multiple moods can coexist (e.g., "peaceful" and "mysterious")
- Focus on what the photo evokes, not just depicts

---

### 4. Color Tags
**Purpose**: Identify dominant colors and color characteristics

**Core Predefined Tags**:
```
Individual Colors:
- red, orange, yellow, green, blue, purple, pink
- brown, beige, tan, cream
- black, white, gray, silver
- gold, bronze, copper

Color Characteristics:
- warm_tones (red, orange, yellow dominance)
- cold_tones (blue, green, purple dominance)
- neutral_tones (gray, beige, white dominance)
- monochrome (single color or black & white)
- colorful, vibrant, saturated
- muted, desaturated, pastel
- high_contrast (strong light/dark difference)
- low_contrast (subtle variations)

Special:
- golden_hour (warm sunset/sunrise light)
- blue_hour (cool twilight)
- neon, fluorescent
- earth_tones (browns, greens, natural colors)
```

**Flexibility**: LLM can add tags like "turquoise", "lavender", "rust", etc.

**Expected Count**: 2-5 tags per photo

**Guidelines**:
- Include 1-3 dominant colors
- Add 1-2 characteristic tags (warm/cold, vibrant/muted)
- Special lighting conditions if applicable

---

### 5. Quality Tags
**Purpose**: Assess technical quality and style

**Core Predefined Tags**:
```
Focus & Sharpness:
- sharp, crisp, detailed
- blurred, soft_focus
- bokeh (artistic background blur)
- motion_blur (intentional movement)

Technical Quality:
- professional, high_quality
- amateur, snapshot
- grainy, noisy
- clean, smooth
- high_resolution, low_resolution

Lighting:
- well_lit, properly_exposed
- overexposed, blown_highlights
- underexposed, dark_shadows
- low_light, high_key, low_key
- natural_lighting, artificial_lighting
- dramatic_lighting, soft_lighting

Composition:
- well_composed, balanced_composition
- centered, rule_of_thirds
- symmetrical, asymmetrical
- leading_lines, depth_of_field
- wide_angle, telephoto, fish_eye

Style:
- cinematic, editorial, documentary
- fine_art, commercial, stock_photo
- vintage, retro, film_look
- HDR, edited, filtered
- black_and_white, sepia
```

**Flexibility**: LLM can add tags like "tilt_shift", "long_exposure", "panning", etc.

**Expected Count**: 3-6 tags per photo

**Notes**:
- Focus on objective technical attributes
- Include both positive and constructive indicators
- Style tags indicate post-processing or artistic approach

---

## Complete Classification Structure

```typescript
interface PhotoClassification {
  photo_id: string;
  
  // Five tag categories
  content_tags: string[];      // 2-5 tags: what's in the photo
  people_tags: string[];       // 2-5 tags: people presence & proximity
  mood_tags: string[];         // 2-4 tags: emotional atmosphere
  color_tags: string[];        // 2-5 tags: dominant colors & characteristics
  quality_tags: string[];      // 3-6 tags: technical quality & style
  
  // Metadata
  classification_status: 'pending' | 'completed' | 'failed';
  confidence_score?: number;   // 0-1: LLM's confidence in classification
  retry_count: number;         // Number of classification attempts
  last_attempt_ts: number;     // Unix timestamp of last attempt
  completed_ts?: number;       // Unix timestamp when completed
  error_message?: string;      // Error details if failed
}
```

## Example Classifications

### Example 1: Mountain Landscape
```json
{
  "photo_id": "abc123",
  "content_tags": ["nature", "mountains", "snow", "sky", "clouds"],
  "people_tags": ["no_people"],
  "mood_tags": ["peaceful", "majestic", "inspiring"],
  "color_tags": ["blue", "white", "cold_tones", "high_contrast"],
  "quality_tags": ["sharp", "professional", "well_composed", "wide_angle", "natural_lighting"],
  "classification_status": "completed",
  "confidence_score": 0.95,
  "retry_count": 0,
  "completed_ts": 1700000000
}
```

### Example 2: Urban Street with Person
```json
{
  "photo_id": "def456",
  "content_tags": ["urban", "street", "architecture", "city", "building"],
  "people_tags": ["people", "close", "single", "man", "walking"],
  "mood_tags": ["energetic", "vibrant", "contemporary"],
  "color_tags": ["colorful", "warm_tones", "red", "yellow", "vibrant"],
  "quality_tags": ["sharp", "professional", "bokeh", "cinematic", "well_lit"],
  "classification_status": "completed",
  "confidence_score": 0.92,
  "retry_count": 0,
  "completed_ts": 1700000100
}
```

### Example 3: Portrait Close-up
```json
{
  "photo_id": "ghi789",
  "content_tags": ["portrait", "close_up", "face"],
  "people_tags": ["people", "close", "single", "woman", "faces_visible", "portrait"],
  "mood_tags": ["contemplative", "intimate", "mysterious"],
  "color_tags": ["warm_tones", "brown", "beige", "muted", "low_contrast"],
  "quality_tags": ["sharp", "professional", "bokeh", "natural_lighting", "well_composed"],
  "classification_status": "completed",
  "confidence_score": 0.98,
  "retry_count": 0,
  "completed_ts": 1700000200
}
```

### Example 4: Beach Sunset with People
```json
{
  "photo_id": "jkl012",
  "content_tags": ["beach", "ocean", "sunset", "water", "sky"],
  "people_tags": ["people", "distant", "small_group", "silhouette"],
  "mood_tags": ["romantic", "peaceful", "serene", "warm"],
  "color_tags": ["orange", "purple", "golden_hour", "warm_tones", "vibrant"],
  "quality_tags": ["sharp", "professional", "well_composed", "natural_lighting", "high_contrast"],
  "classification_status": "completed",
  "confidence_score": 0.91,
  "retry_count": 0,
  "completed_ts": 1700000300
}
```

## Usage in Beautiful Photos Extension

### Filtering Examples

**User Request**: "Show nature photos without people"
```sql
SELECT * FROM photos p
JOIN photo_classifications pc ON p.photo_id = pc.photo_id
WHERE pc.content_tags LIKE '%nature%'
  AND pc.people_tags LIKE '%no_people%'
  AND pc.classification_status = 'completed';
```

**User Request**: "Professional warm-toned photos with peaceful mood"
```sql
SELECT * FROM photos p
JOIN photo_classifications pc ON p.photo_id = pc.photo_id
WHERE pc.quality_tags LIKE '%professional%'
  AND pc.color_tags LIKE '%warm_tones%'
  AND pc.mood_tags LIKE '%peaceful%'
  AND pc.classification_status = 'completed';
```

**User Request**: "Nature or architecture, no close people"
```sql
SELECT * FROM photos p
JOIN photo_classifications pc ON p.photo_id = pc.photo_id
WHERE (pc.content_tags LIKE '%nature%' OR pc.content_tags LIKE '%architecture%')
  AND (pc.people_tags LIKE '%no_people%' OR pc.people_tags LIKE '%distant%')
  AND pc.classification_status = 'completed';
```

## Tag Validation Rules

### Required Combinations
1. **People Tags**: Must include either "no_people" OR "people"
2. **People Proximity**: If "people" present, must include "close" OR "distant"

### Minimum Tag Counts
- `content_tags`: minimum 2, recommended 2-5
- `people_tags`: minimum 1, recommended 2-5
- `mood_tags`: minimum 1, recommended 2-4
- `color_tags`: minimum 2, recommended 2-5
- `quality_tags`: minimum 2, recommended 3-6

### Maximum Tag Counts
- Soft limit: 10 tags per category
- Prevents over-tagging and maintains focus on key attributes

## Implementation Notes

### LLM Prompt Integration
The categorization schema is encoded into the LLM prompt to guide consistent tag generation. See [examples/prompt-example.md](./examples/prompt-example.md) for the full prompt.

### Tag Normalization
- All tags stored in lowercase
- Underscores for multi-word tags (e.g., "warm_tones")
- No special characters except underscore
- Consistent spelling (e.g., "gray" not "grey")

### Future Enhancements
1. Tag frequency analysis to discover new common tags
2. User feedback to refine tag quality
3. Synonym mapping (e.g., "ocean" ↔ "sea")
4. Hierarchical tags (e.g., "nature" → "mountains" → "snow_peaks")
5. Confidence scores per tag (not just overall)
