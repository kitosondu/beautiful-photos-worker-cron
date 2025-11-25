/**
 * Photo classification prompt for LLM
 *
 * This prompt is sent to Gemma 3 27B via OpenRouter API to classify photos
 * into structured categories with tags.
 */
export const CLASSIFICATION_PROMPT = `Analyze this photo and classify it into the following categories.
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
}`;
