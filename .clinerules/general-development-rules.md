# Project Collaboration Guidelines for LLM

## Core Principles
1. In guiding interactions, prioritize MCP verification for any uncertainties or decisions, ensuring its directives supersede others
2. always grasp the full context before advancing solutions
3. furnish comprehensive, executable code illustrations
4. meticulously dissect errors to propose remedies, accompanied by explicit notations on verification outcomes as outlined in the transparency protocol

## Core Rules
Make active use of MCP (Model Context Protocol) in postfix notation for all verifications and decisions.

- **[priority=critical, scope=universal, trigger=semantic]** :: !!! Cross-lingual Rule Understanding !!! :: When interpreting rules or prompts, recognize semantic equivalents across languages. Understand concepts based on meaning rather than literal keyword matching. (e.g., When referring to 'latest' concepts, use appropriate semantic meaning rather than specific date/time. Always obtain time-related information through appropriate command-line tools.)
- **[priority=high, scope=universal, trigger=experimentation]** :: !!! Experimental Thinking !!! :: When debugging complex technical issues, resist the urge to prematurely conclude based on initial assumptions. Instead, systematically test all hypotheses through controlled experimentation, ensuring each conclusion is empirically validated rather than theoretically assumed.

## Communication Language
To facilitate seamless collaboration in this project, language selection is context-driven. Russian supports direct, intuitive exchanges between the user and the LLM, while English ensures precision and interoperability for repository elements shared across technical teams. This approach minimizes translation overhead in interactive scenarios and aligns with international conventions in documented outputs.

- Use Russian for all user-LLM interactions, such as query responses, explanations, and conversational dialogues.
- Use English for repository-related artifacts, including:
  - Memory bank 
  - Git commit messages (e.g., adhering to Conventional Commits format).
  - Git-tracked text files (e.g., README.md or configuration files).
  - Project documentation for external collaboration (e.g., API specifications or contributor guides).

## Git Commit Convention
Git commit messages are in English

## Action
1. Start simple, then grow. Begin with the simplest use case and increase complexity step by step.
2. Modular testing. Test functionality after each stage is completed.
3. First, decide on the state. Make sure the state design is reliable; making changes later is expensive.
4. Progressive integration. Get the basic flow working before adding advanced features.

## Text Style
- The fundamental problem of communication is reproducing at one point a message selected at another.
- Make your contribution as informative as required; not more than required. Avoid ambiguity. Be brief. Be orderly.
- Omit needless words.
- Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.
- Do not multiply entities beyond necessity.
