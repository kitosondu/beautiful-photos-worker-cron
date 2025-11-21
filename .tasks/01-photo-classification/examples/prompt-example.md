# Classification Prompt Example

## Full Prompt Template

This is the exact prompt sent to Gemma 3 27B via OpenRouter API for photo classification.

```text
Analyze this photo and classify it into the following categories.
Return ONLY a valid JSON object with these exact keys (no markdown, no code blocks):

{
  "content_tags": [],
  "people_tags": [],
  "mood_tags": [],
  "color_tags": [],
  "quality_tags": [],
  "confidence": 0.0
}

CATEGORY GUIDELINES:

1. CONTENT TAGS (2-5 tags): What's physically in the photo
   Core tags: nature, mountains, forest, beach, ocean, desert, sky, clouds, urban, city, architecture, building, street, interior, food, technology, vehicle, sports, art, music, fashion, abstract, underwater, aerial, wildlife, flowers
   Add custom tags for unique content

2. PEOPLE TAGS (1-5 tags): Human presence and proximity
   REQUIRED: Include either "no_people" OR "people"
   If "people" present, REQUIRED: Include either "close" OR "distant"
   
   "close" criteria (ANY ONE triggers it):
   - Portrait shots (face is main subject)
   - Person within 1-2 meters of camera
   - Person occupies more than 30% of frame
   
   Additional tags: single, couple, small_group, group, crowd, man, woman, child, faces_visible, faces_hidden, portrait, interaction, walking, sitting
   
3. MOOD TAGS (2-4 tags): Emotional atmosphere
   Core tags: peaceful, serene, joyful, energetic, dramatic, mysterious, romantic, contemplative, melancholic, playful, inspiring, moody, bold
   Add custom tags for unique moods

4. COLOR TAGS (2-5 tags): Dominant colors and characteristics
   Individual colors: red, orange, yellow, green, blue, purple, pink, brown, black, white, gray
   Characteristics: warm_tones, cold_tones, monochrome, colorful, vibrant, muted, pastel, high_contrast, low_contrast, golden_hour, blue_hour
   Add custom color tags if needed

5. QUALITY TAGS (3-6 tags): Technical quality and style
   Core tags: sharp, blurred, bokeh, professional, amateur, grainy, well_lit, low_light, well_composed, cinematic, vintage, HDR, black_and_white, natural_lighting, dramatic_lighting, wide_angle
   Add custom quality tags

IMPORTANT RULES:
- Use lowercase with underscores for multi-word tags
- Select most relevant tags only (don't over-tag)
- Be specific and accurate
- Confidence should reflect your certainty (0.0 to 1.0)
- Return ONLY the JSON object, nothing else

Example output:
{
  "content_tags": ["nature", "mountains", "snow", "sky"],
  "people_tags": ["no_people"],
  "mood_tags": ["peaceful", "majestic", "inspiring"],
  "color_tags": ["blue", "white", "cold_tones", "high_contrast"],
  "quality_tags": ["sharp", "professional", "well_composed", "natural_lighting"],
  "confidence": 0.95
}
```

## Request Format

### Complete API Request

```json
{
  "model": "google/gemma-3-27b-it",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "<FULL PROMPT FROM ABOVE>"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
            "detail": "auto"
          }
        }
      ]
    }
  ],
  "max_tokens": 1000,
  "temperature": 0.3,
  "top_p": 0.9
}
```

## Example Classifications

### Example 1: Mountain Landscape

**Photo URL**: `https://images.unsplash.com/photo-1506905925346-21bda4d32df4`

**Expected Response:**
```json
{
  "content_tags": ["nature", "mountains", "snow", "sky", "landscape"],
  "people_tags": ["no_people"],
  "mood_tags": ["peaceful", "majestic", "serene", "inspiring"],
  "color_tags": ["blue", "white", "cold_tones", "high_contrast"],
  "quality_tags": ["sharp", "professional", "well_composed", "natural_lighting", "wide_angle"],
  "confidence": 0.95
}
```

**Analysis:**
- ✅ Content: Clear landscape elements identified
- ✅ People: Correctly identified no people
- ✅ Mood: Appropriate emotional tags
- ✅ Colors: Accurate color assessment
- ✅ Quality: Professional quality indicators
- ✅ Confidence: High confidence appropriate for clear subject

---

### Example 2: Urban Street Photography

**Photo URL**: `https://images.unsplash.com/photo-1449824913935-59a10b8d2000`

**Expected Response:**
```json
{
  "content_tags": ["urban", "street", "city", "architecture", "building"],
  "people_tags": ["people", "close", "single", "walking", "man"],
  "mood_tags": ["energetic", "contemporary", "vibrant", "dynamic"],
  "color_tags": ["colorful", "warm_tones", "vibrant", "red", "yellow"],
  "quality_tags": ["sharp", "professional", "bokeh", "well_composed", "natural_lighting"],
  "confidence": 0.92
}
```

**Analysis:**
- ✅ Content: Urban elements correctly identified
- ✅ People: Person present, classified as close (main subject)
- ✅ Mood: Urban energy captured
- ✅ Colors: Warm, vibrant city colors
- ✅ Quality: Professional composition noted

---

### Example 3: Portrait Close-up

**Photo URL**: `https://images.unsplash.com/photo-1494790108377-be9c29b29330`

**Expected Response:**
```json
{
  "content_tags": ["portrait", "face", "close_up"],
  "people_tags": ["people", "close", "single", "woman", "faces_visible", "portrait"],
  "mood_tags": ["contemplative", "serene", "intimate", "gentle"],
  "color_tags": ["warm_tones", "brown", "muted", "natural_tones", "soft"],
  "quality_tags": ["sharp", "professional", "bokeh", "natural_lighting", "well_composed", "soft_focus"],
  "confidence": 0.98
}
```

**Analysis:**
- ✅ Content: Portrait clearly identified
- ✅ People: Close proximity correctly detected (face is main subject)
- ✅ Mood: Gentle, contemplative atmosphere
- ✅ Colors: Warm, natural tones
- ✅ Quality: Professional portrait techniques noted

---

### Example 4: Beach Sunset with Distant People

**Photo URL**: `https://images.unsplash.com/photo-1507525428034-b723cf961d3e`

**Expected Response:**
```json
{
  "content_tags": ["beach", "ocean", "sunset", "water", "sky"],
  "people_tags": ["people", "distant", "small_group", "silhouette"],
  "mood_tags": ["romantic", "peaceful", "serene", "dreamy"],
  "color_tags": ["orange", "purple", "warm_tones", "golden_hour", "vibrant"],
  "quality_tags": ["sharp", "professional", "well_composed", "natural_lighting", "high_contrast"],
  "confidence": 0.91
}
```

**Analysis:**
- ✅ Content: Beach sunset scene identified
- ✅ People: People present but distant (silhouettes)
- ✅ Mood: Romantic sunset atmosphere
- ✅ Colors: Golden hour colors captured
- ✅ Quality: Professional sunset photography

---

### Example 5: Food Photography

**Photo URL**: `https://images.unsplash.com/photo-1504674900247-0877df9cc836`

**Expected Response:**
```json
{
  "content_tags": ["food", "cuisine", "meal", "indoor", "close_up"],
  "people_tags": ["no_people"],
  "mood_tags": ["appetizing", "warm", "inviting", "cozy"],
  "color_tags": ["warm_tones", "orange", "brown", "yellow", "vibrant"],
  "quality_tags": ["sharp", "professional", "well_lit", "bokeh", "well_composed"],
  "confidence": 0.93
}
```

**Analysis:**
- ✅ Content: Food subject clearly identified
- ✅ People: No people in frame
- ✅ Mood: Appetizing, inviting atmosphere
- ✅ Colors: Warm food photography tones
- ✅ Quality: Professional food styling noted

---

### Example 6: Abstract Architecture

**Photo URL**: `https://images.unsplash.com/photo-1486406146926-c627a92ad1ab`

**Expected Response:**
```json
{
  "content_tags": ["architecture", "abstract", "building", "urban", "modern"],
  "people_tags": ["no_people"],
  "mood_tags": ["bold", "striking", "minimalist", "contemporary"],
  "color_tags": ["blue", "white", "cold_tones", "high_contrast", "minimal"],
  "quality_tags": ["sharp", "professional", "well_composed", "geometric", "clean"],
  "confidence": 0.94
}
```

**Analysis:**
- ✅ Content: Abstract architectural elements
- ✅ People: No people present
- ✅ Mood: Bold, minimalist feeling
- ✅ Colors: Cool, minimal color palette
- ✅ Quality: Clean, professional composition

---

## Edge Cases

### Edge Case 1: Very Blurred Photo

**Expected Behavior:**
```json
{
  "content_tags": ["abstract", "unclear"],
  "people_tags": ["no_people"],
  "mood_tags": ["mysterious", "unclear"],
  "color_tags": ["muted", "blurred"],
  "quality_tags": ["blurred", "low_quality", "unclear"],
  "confidence": 0.3
}
```

**Note**: Low confidence score indicates uncertainty

---

### Edge Case 2: Multiple People at Various Distances

**Expected Behavior:**
```json
{
  "content_tags": ["urban", "street", "city"],
  "people_tags": ["people", "close", "group", "walking"],
  "mood_tags": ["busy", "energetic", "dynamic"],
  "color_tags": ["colorful", "vibrant"],
  "quality_tags": ["sharp", "well_composed"],
  "confidence": 0.88
}
```

**Rule Applied**: If ANY person meets "close" criteria, tag as "close"

---

### Edge Case 3: Night Photography

**Expected Behavior:**
```json
{
  "content_tags": ["urban", "city", "night", "lights"],
  "people_tags": ["no_people"],
  "mood_tags": ["mysterious", "moody", "dramatic", "atmospheric"],
  "color_tags": ["dark", "blue_hour", "black", "colorful", "neon"],
  "quality_tags": ["sharp", "professional", "low_light", "high_contrast", "dramatic_lighting"],
  "confidence": 0.89
}
```

---

## Validation Rules

### Must Pass Validation:
1. ✅ `people_tags` includes either "no_people" OR "people"
2. ✅ If "people" present, includes either "close" OR "distant"
3. ✅ Minimum 2 content_tags
4. ✅ Minimum 1 people_tag
5. ✅ Minimum 1 mood_tag
6. ✅ Minimum 2 color_tags
7. ✅ Minimum 2 quality_tags
8. ✅ Confidence score between 0.0 and 1.0
9. ✅ All tags are lowercase with underscores

### Example Invalid Response:

```json
{
  "content_tags": ["nature"],  // ❌ Only 1 tag (minimum 2)
  "people_tags": ["some_person"],  // ❌ Missing "people" or "no_people"
  "mood_tags": [],  // ❌ Empty (minimum 1)
  "color_tags": ["Blue"],  // ❌ Not lowercase
  "quality_tags": ["sharp"],  // ❌ Only 1 tag (minimum 2)
  "confidence": 1.5  // ❌ Outside valid range
}
```

This would be rejected and marked as failed classification.

---

## Implementation Notes

1. **Prompt Consistency**: Always use the exact same prompt for all classifications to ensure consistent results
2. **Temperature Setting**: 0.3 provides good balance between creativity and consistency
3. **Max Tokens**: 1000 tokens is sufficient for tag generation
4. **Image Size**: 600px width is optimal for classification accuracy vs cost
5. **Error Handling**: Parse errors should trigger retry with same prompt
6. **Validation**: Always validate response before saving to database
