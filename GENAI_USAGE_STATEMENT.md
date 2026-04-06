# GenAI Usage Explanation: Google Meet AI Scribe

**Role of Generative AI in the Development Process:**

Generative AI was heavily utilized as a core pair-programming companion and architectural assistant throughout the lifecycle of this project. Instead of just using AI for basic code generation, it was leveraged to solve complex engineering bottlenecks, optimize deployment strategies, and power the application's core functionality.

Below is a breakdown of how GenAI was utilized across the stack:

### 1. Overcoming Google Meet's Anti-Bot Protections
One of the hardest challenges was getting the bot into a Google Meet bypassing their heavily obfuscated DOM structure and bot-detection heuristics.
*   **Selenium/Undetected-Chromedriver:** I worked with an AI coding agent to migrate away from standard Puppeteer (which was consistently blocked) to a customized Python `undetected_chromedriver` implementation. The AI helped inject specialized Chrome flags (`--use-fake-ui-for-media-stream` and internal preferences) to cleanly bypass hardware permission popups and mute the bot automatically upon entry.
*   **Algorithmic Scraping:** Google Meet frequently randomizes the CSS classes of its subtitles to break scrapers. Instead of relying on brittle DOM selectors, the AI helped me design and implement a pure mathematical "suffix-prefix overlap algorithm." This script captures the entire raw text state of the meeting every second and mathematically calculates the exact new words spoken, perfectly eliminating duplicate sentences caused by scrolling text.

### 2. The AI Summarization Pipeline (Gemini 3.1 Flash-Lite)
The core objective of the scribe is summarizing the meeting. AI was used both to *build* the pipeline and *serve* as the pipeline.
*   **SDK Migration:** During development, the AI assistant helped identify that the local environment was caching old Gemini 1.5 models. It orchestrated the migration to the brand-new `@google/generative-ai@latest` SDK so the application could tap into the ultra-fast, context-heavy `gemini-3.1-flash-lite` model.
*   **Prompt Engineering:** The AI helped refine strict few-shot prompting techniques to instruct Gemini to extract an Executive Summary, Action Items, Key Decisions, and specific Speaker Analytics (statement counts and engagement metrics) from messy, fragmented meeting transcripts.

### 3. Full-Stack Architecture & Design
*   **UI/UX:** I utilized the AI to rapidly translate my design vision into a clean, modern "Glassmorphism" React interface using Vite. We generated iterative CSS to perfect the dark-mode aesthetic, animations, and typography to make the dashboard feel premium.
*   **Cloud Integrations:** The AI assisted with structuring the Google Cloud Storage (`@google-cloud/storage`) and Firebase Authentication modules to satisfy the bonus requirements, ensuring graceful degradation mechanisms were in place so the application could securely default back to local environments if strictly needed during testing. 
*   **CI/CD Deployment:** Finally, it guided the deployment orchestration—configuring the `netlify.toml` for the frontend and `render.yaml` for the heavily customized background-process backend.

In conclusion, GenAI vastly accelerated the iteration cycle of this project, allowing me to focus on high-level architectural decisions and edge-case problem solving rather than manual boilerplate, resulting in a production-ready system in a fraction of the time.
