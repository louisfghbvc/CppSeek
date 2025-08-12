# Unified System Workflow: Memory Bank + Task Magic

This document describes the complete operational workflow for the unified Memory Bank + Task Magic system, covering AI agent session management, task operations, and continuous learning patterns.

## System Overview

```mermaid
graph TD
    subgraph "AI Agent Session Lifecycle"
        Start[New AI Session] --> MB_Init[Memory Bank Initialization]
        MB_Init --> TM_Init[Task Magic Integration]
        TM_Init --> Ready[Ready for Operations]
        Ready --> Operations[Execute Operations]
        Operations --> Learn[Learn & Update]
        Learn --> End[Session End]
    end
    
    subgraph "Memory Bank Core"
        MB_Files[Memory Bank Files]
        MB_Context[Active Context]
        MB_Intelligence[Project Intelligence]
    end
    
    subgraph "Task Magic Core"
        TM_Active[Active Tasks]
        TM_Plans[Current Plans]
        TM_Archive[Historical Archive]
    end
    
    MB_Init --> MB_Files
    TM_Init --> TM_Active
    Learn --> MB_Intelligence
```

## Phase 1: Session Initialization

### 1.1 Auto-Detection Protocol (MANDATORY FIRST STEP)

```mermaid
flowchart TD
    Session[New AI Session] --> ConfigExists{.ai/.system-config exists?}
    
    ConfigExists -->|Yes| ReadConfig[Read Configuration]
    ConfigExists -->|No| FirstTime[First Time Setup]
    
    ReadConfig --> ValidConfig{Configuration Valid?}
    ValidConfig -->|Yes| ApplyMode[Apply Saved Mode]
    ValidConfig -->|No| ReDetect[Re-run Detection]
    
    FirstTime --> AutoDetect[Auto-detect from Plan]
    ReDetect --> AutoDetect
    
    AutoDetect --> ReadPlan[Read .ai/plans/PLAN.md]
    ReadPlan --> Analyze[Analyze Plan Content]
    Analyze --> Decision{Memory Bank Needed?}
    
    Decision -->|Yes| EnableMB[Enable Memory Bank Mode]
    Decision -->|No| TaskOnly[Task Magic Only Mode]
    
    EnableMB --> SaveConfig[Save to .ai/.system-config]
    TaskOnly --> SaveConfig
    SaveConfig --> ApplyMode
    
    ApplyMode --> InitializeSystem[Initialize Selected System]
```

### 1.2 Memory Bank Initialization (When Enabled)

```mermaid
flowchart TD
    Session[New AI Session] --> Check[Check Memory Bank Files]
    Check --> Exists{All Files Exist?}
    
    Exists -->|Yes| ReadAll[Read ALL Memory Bank Files]
    Exists -->|No| Create[Create Missing Files]
    
    Create --> Template[Use Template Structure]
    Template --> Populate[Populate with Current Context]
    Populate --> ReadAll
    
    ReadAll --> Hierarchy[Apply File Hierarchy]
    Hierarchy --> Context[Establish Full Context]
    Context --> Ready[Memory Bank Ready]
```

**Required Actions:**
1. **Read `memory-bank/projectbrief.md`** - Foundation understanding
2. **Read `memory-bank/productContext.md`** - Product goals and problems
3. **Read `memory-bank/systemPatterns.md`** - Architecture and patterns  
4. **Read `memory-bank/techContext.md`** - Technical environment
5. **Read `memory-bank/activeContext.md`** - Current work focus
6. **Read `memory-bank/progress.md`** - Current status and progress

### 1.3 Task Magic Integration (Always Active)

```mermaid
flowchart TD
    MB_Ready[Memory Bank Ready] --> TM_Check[Check Task Magic State]
    TM_Check --> ActiveTasks[Review .ai/TASKS.md]
    ActiveTasks --> History[Check .ai/memory/ archives]
    History --> Plans[Review .ai/plans/]
    Plans --> Sync[Synchronize Understanding]
    Sync --> Unified[Unified Context Established]
```

## Phase 2: Operation Modes

### 2.0 Mode Detection and Enforcement

**MANDATORY MODE CHECK**: Before processing ANY user request, determine the appropriate mode:

```mermaid
flowchart TD
    Request[User Request] --> Analyze[Analyze Request Keywords]
    Analyze --> PlanKeywords{Contains Plan Keywords?}
    Analyze --> ActKeywords{Contains Act Keywords?}
    
    PlanKeywords -->|Yes| ForcePlan[FORCE PLAN MODE]
    ActKeywords -->|Yes| ForceAct[FORCE ACT MODE]
    
    PlanKeywords -->|No| ActKeywords
    ActKeywords -->|No| AskUser[Ask User to Clarify Mode]
    
    ForcePlan --> PlanRestrictions[Apply Plan Mode Restrictions]
    ForceAct --> ActPermissions[Apply Act Mode Permissions]
    AskUser --> UserChoice[Wait for User Clarification]
    
    UserChoice --> ForcePlan
    UserChoice --> ForceAct
```

**Detection Keywords:**

**PLAN MODE Triggers** (Prevents code generation):
- plan, planning, strategy, design, architecture
- requirements, specification, analyze, breakdown
- structure, PRD, document, outline, roadmap
- "what should we build", "how should this work"
- "create a plan", "design the system"

**ACT MODE Triggers** (Allows code generation):
- implement, code, build, create files, develop
- write code, program, execute, run, install
- fix bugs, debug, patch, deploy, setup
- "start coding", "create the files", "implement this"

**Ambiguous Requests**: If unclear, ASK THE USER:
> "Would you like me to create a plan/design (Plan Mode) or start implementing code (Act Mode)?"

### 2.1 Plan Mode Workflow

```mermaid
flowchart TD
    PlanMode[Plan Mode Triggered] --> ReadContext[Read Memory Bank Context]
    ReadContext --> CheckFiles{Files Complete?}
    
    CheckFiles -->|No| CreatePlan[Create Missing Context]
    CreatePlan --> DocumentPlan[Document Plan in Chat]
    
    CheckFiles -->|Yes| VerifyContext[Verify Current Context]
    VerifyContext --> Strategy[Develop Strategy]
    Strategy --> Present[Present Approach to User]
    
    Present --> Approval{User Approval?}
    Approval -->|No| Revise[Revise Plan]
    Revise --> Strategy
    Approval -->|Yes| ActMode[Switch to Act Mode]
```

**CRITICAL PLAN MODE RESTRICTIONS:**

🚫 **PLAN MODE MUST NEVER:**
- Generate ANY code files (.py, .js, .ts, .html, .css, etc.)
- Create implementation files
- Write actual source code
- Execute code-related commands
- Install dependencies or packages
- Run build/compile commands

✅ **PLAN MODE ONLY CREATES:**
- Planning documents (.md files in .ai/plans/)
- Architecture diagrams (Mermaid)
- PRD documents (Product Requirements Documents)
- Technical specification documents
- Task breakdown structures
- Design documentation
- Analysis reports

**Plan Mode Detection Rules:**
```
PLAN MODE is triggered when user requests contain:
- "plan", "planning", "strategy", "design"
- "architecture", "requirements", "specification"
- "analyze", "breakdown", "structure"
- "PRD", "document", "outline"
- ANY request for planning without explicit "implement" or "code"

ACT MODE is triggered when user requests contain:
- "implement", "code", "build", "create files"
- "write code", "develop", "program"
- "execute", "run", "install"
- "fix bugs", "debug", "patch"
- Explicit request to create .py/.js/.ts files
```

**Plan Mode Output Rules:**
1. **Documentation Only**: Create comprehensive planning documents
2. **No Code Generation**: Absolutely no source code file creation
3. **Strategy Focus**: Focus on high-level architecture and approach
4. **Task Preparation**: Prepare detailed task breakdown for Act Mode
5. **Context Building**: Ensure all necessary context is documented

### 2.2 Act Mode Workflow

```mermaid
flowchart TD
    ActMode[Act Mode Triggered] --> CheckContext[Check Memory Bank]
    CheckContext --> Execute[Execute Task]
    
    Execute --> TaskType{Task Type?}
    
    TaskType -->|Memory Update| MB_Update[Update Memory Bank]
    TaskType -->|Task Creation| TM_Create[Create Task Magic Task]
    TaskType -->|Task Execution| TM_Execute[Execute Task Magic Task]
    TaskType -->|Integration| Both[Update Both Systems]
    
    MB_Update --> Sync1[Sync with Task Magic]
    TM_Create --> Sync2[Sync with Memory Bank]
    TM_Execute --> Sync3[Update Memory Bank Progress]
    Both --> Sync4[Full System Sync]
    
    Sync1 --> Document[Document Changes]
    Sync2 --> Document
    Sync3 --> Document
    Sync4 --> Document
    
    Document --> Learn[Learn from Experience]
```

**CRITICAL ACT MODE PERMISSIONS:**

✅ **ACT MODE CAN:**
- Generate and create source code files (.py, .js, .ts, etc.)
- Implement actual functionality
- Install dependencies and packages
- Run build/compile/test commands
- Execute code and scripts
- Create project structure and directories
- Apply patches and fixes
- Integrate with external APIs
- Set up development environment

🚫 **ACT MODE SHOULD NOT:**
- Create new planning documents without explicit request
- Modify global project strategy without user confirmation
- Make architectural decisions without referring to plans
- Skip task dependency checks
- Ignore established patterns from Memory Bank

**Act Mode Requirements:**
1. **Plan Reference**: Always refer to existing plans before implementation
2. **Task-Based**: Execute specific tasks from .ai/TASKS.md
3. **Memory Bank Sync**: Update progress and context after significant changes
4. **Quality Assurance**: Ensure code quality and testing
5. **Documentation**: Update technical documentation as needed

**Mode Transition Rules:**
- **Plan → Act**: Only after user approves the plan and requests implementation
- **Act → Plan**: When encountering undefined requirements or architectural questions
- **Auto-detection**: Based on user request keywords (see Plan Mode Detection Rules above)

## Phase 3: Task Magic Operations

### 3.1 Task Creation and Management

```mermaid
flowchart TD
    TaskReq[Task Request] --> PlanTasks[Plan All Tasks]
    PlanTasks --> Expansion{Complex Tasks?}
    
    Expansion -->|Yes| SubTasks[Define Sub-tasks]
    Expansion -->|No| UpdateMaster[Update .ai/TASKS.md]
    
    SubTasks --> ParentTasks[Update Parent Tasks]
    ParentTasks --> UpdateMaster
    
    UpdateMaster --> CreateFiles[Create Individual Task Files]
    CreateFiles --> PopulateYAML[Populate YAML & Markdown]
    PopulateYAML --> SyncMB[Update Memory Bank activeContext.md]
    SyncMB --> Ready[Tasks Ready]
```

### 3.2 Task Execution Workflow

```mermaid
flowchart TD
    Execute[Execute Task Request] --> ReadTasks[Read .ai/TASKS.md]
    ReadTasks --> FindTask[Find First Pending Task]
    FindTask --> CheckDeps{Dependencies Met?}
    
    CheckDeps -->|No| NotifyUser[Notify User: Dependencies Missing]
    CheckDeps -->|Yes| UpdateStatus[Update Task Status: inprogress]
    
    UpdateStatus --> UpdateMaster[Update TASKS.md marker]
    UpdateMaster --> ExecuteTask[Execute Task]
    
    ExecuteTask --> Result{Task Result?}
    
    Result -->|Success| Success[Update status: completed]
    Result -->|Failure| Failure[Update status: failed, add error_log]
    
    Success --> UpdateMasterSuccess[Update TASKS.md: completed]
    Failure --> UpdateMasterFailed[Update TASKS.md: failed]
    
    UpdateMasterSuccess --> UpdateProgress[Update Memory Bank progress.md]
    UpdateMasterFailed --> UpdateProgress
    
    UpdateProgress --> Complete[Task Complete]
```

### 3.3 Task Archival Workflow

```mermaid
flowchart TD
    Archive[Archive Request] --> FindCompleted[Find Completed/Failed Tasks]
    FindCompleted --> MoveFiles[Move task files to .ai/memory/tasks/]
    MoveFiles --> UpdateLog[Append summary to .ai/memory/TASKS_LOG.md]
    UpdateLog --> RemoveEntries[Remove entries from .ai/TASKS.md]
    RemoveEntries --> UpdateMB[Update Memory Bank progress.md]
    UpdateMB --> UpdateActive[Update activeContext.md]
    UpdateActive --> ArchiveComplete[Archive Complete]
```

## Phase 4: Memory Bank Update Workflows

### 4.1 Automatic Update Triggers

```mermaid
flowchart TD
    Trigger{Update Trigger} --> Type{Trigger Type?}
    
    Type -->|Task Completed| TaskComplete[Update progress.md]
    Type -->|New Pattern| PatternUpdate[Update systemPatterns.md]
    Type -->|Work Focus Change| FocusUpdate[Update activeContext.md]
    Type -->|Tech Decision| TechUpdate[Update techContext.md]
    Type -->|Manual Request| ManualUpdate[Review ALL files]
    
    TaskComplete --> SyncTM1[Sync with Task Magic]
    PatternUpdate --> SyncTM2[Sync with Task Magic]
    FocusUpdate --> SyncTM3[Sync with Task Magic]
    TechUpdate --> SyncTM4[Sync with Task Magic]
    ManualUpdate --> ReviewAll[Review ALL Memory Bank Files]
    
    ReviewAll --> UpdateNeeded{Updates Needed?}
    UpdateNeeded -->|Yes| UpdateFiles[Update Relevant Files]
    UpdateNeeded -->|No| DocumentState[Document Current State]
    
    UpdateFiles --> DocumentState
    DocumentState --> SyncTM5[Sync with Task Magic]
    
    SyncTM1 --> Complete[Update Complete]
    SyncTM2 --> Complete
    SyncTM3 --> Complete
    SyncTM4 --> Complete
    SyncTM5 --> Complete
```

### 4.2 Manual Memory Bank Update Process

```mermaid
flowchart TD
    Manual["Manual 'update memory bank' Request"] --> ReadAll[MANDATORY: Read ALL Files]
    
    ReadAll --> ReviewFiles[Review Each File]
    ReviewFiles --> ProjectBrief[Review projectbrief.md]
    ProjectBrief --> ProductContext[Review productContext.md]
    ProductContext --> SystemPatterns[Review systemPatterns.md]
    SystemPatterns --> TechContext[Review techContext.md]
    TechContext --> ActiveContext[Review activeContext.md]
    ActiveContext --> Progress[Review progress.md]
    
    Progress --> Identify[Identify Updates Needed]
    Identify --> Update[Update Relevant Files]
    Update --> Consistency[Verify Consistency]
    Consistency --> Sync[Sync with Task Magic]
    Sync --> Complete[Update Complete]
```

## Phase 5: Project Intelligence & Learning

### 5.1 Pattern Discovery and Learning

```mermaid
flowchart TD
    Experience[New Experience/Pattern] --> Identify[Identify Pattern Type]
    Identify --> Validate[Validate with User]
    Validate --> Document[Document in .cursor/rules]
    Document --> Apply[Apply in Future Work]
    
    Identify --> Categories{Pattern Category?}
    Categories -->|Implementation| ImplPattern[Implementation Path]
    Categories -->|User Preference| UserPattern[User Workflow]
    Categories -->|Technical| TechPattern[Technical Decision]
    Categories -->|Process| ProcessPattern[Process Improvement]
    
    ImplPattern --> Document
    UserPattern --> Document
    TechPattern --> Document
    ProcessPattern --> Document
```

### 5.2 Continuous Improvement Cycle

```mermaid
flowchart TD
    Start[Session Start] --> ReadRules[Read .cursor/rules]
    ReadRules --> ApplyLearning[Apply Learned Patterns]
    ApplyLearning --> Work[Execute Work]
    Work --> Observe[Observe Outcomes]
    Observe --> NewInsights{New Insights?}
    
    NewInsights -->|Yes| CaptureInsight[Capture New Insight]
    NewInsights -->|No| SessionEnd[Session End]
    
    CaptureInsight --> UpdateRules[Update .cursor/rules]
    UpdateRules --> SessionEnd
```

## Phase 6: Error Handling and Recovery

### 6.1 System State Recovery

```mermaid
flowchart TD
    Error[System Error Detected] --> Assess[Assess Damage]
    Assess --> ErrorType{Error Type?}
    
    ErrorType -->|Memory Bank| MBError[Memory Bank Issue]
    ErrorType -->|Task Magic| TMError[Task Magic Issue]
    ErrorType -->|Both Systems| BothError[Both Systems Issue]
    
    MBError --> RecoverFromTM[Recover from Task Magic]
    TMError --> RecoverFromMB[Recover from Memory Bank]
    BothError --> ManualRecover[Manual Recovery Required]
    
    RecoverFromTM --> Verify[Verify Recovery]
    RecoverFromMB --> Verify
    ManualRecover --> UserInput[Request User Input]
    
    UserInput --> Verify
    Verify --> Complete[Recovery Complete]
```

### 6.2 Data Consistency Checks

```mermaid
flowchart TD
    Check[Consistency Check] --> MemoryBank[Check Memory Bank Files]
    MemoryBank --> TaskMagic[Check Task Magic State]
    TaskMagic --> Compare[Compare Systems]
    Compare --> Conflicts{Conflicts Found?}
    
    Conflicts -->|Yes| Resolve[Resolve Conflicts]
    Conflicts -->|No| Healthy[System Healthy]
    
    Resolve --> Priority[Apply Priority Rules]
    Priority --> Update[Update Systems]
    Update --> Verify[Verify Resolution]
    Verify --> Healthy
```

## System Responsibility Matrix

### Clear Separation of Concerns

```mermaid
graph TD
    subgraph "Memory Bank System"
        MB_P[Project State & Context]
        MB_T[Technical Decisions]
        MB_PR[Progress Tracking]
        MB_A[Active Work Focus]
        
        MB_P --> MB_Files[memory-bank/ files]
        MB_T --> MB_Files
        MB_PR --> MB_Files
        MB_A --> MB_Files
    end
    
    subgraph "Task Magic System"
        TM_L[Task Lifecycle]
        TM_D[Dependencies]
        TM_H[Historical Archive]
        
        TM_L --> TM_Files[.ai/ files]
        TM_D --> TM_Files
        TM_H --> TM_Files
    end
    
    subgraph "AI Agent Learning"
        AI_P[User Preferences]
        AI_B[Behavior Patterns]
        AI_W[Workflow Improvements]
        
        AI_P --> Rules_Files[.cursor/rules files]
        AI_B --> Rules_Files
        AI_W --> Rules_Files
    end
```

### Update Responsibility Rules

| System | Updates | Never Updates |
|--------|---------|---------------|
| **Memory Bank** | Project context, progress, technical decisions | .cursor/rules, task files |
| **Task Magic** | Task status, dependencies, archives | Memory Bank files, .cursor/rules |
| **AI Agent** | .cursor/rules based on experience | Memory Bank content, task details |

### Data Flow Boundaries

```mermaid
flowchart TD
    Experience[AI Agent Experience] --> Learn{Learning Type?}
    
    Learn -->|Project Context| MB_Update[Update Memory Bank]
    Learn -->|Task Progress| TM_Update[Update Task Magic]
    Learn -->|Behavior Pattern| Rules_Update[Update .cursor/rules]
    
    MB_Update --> MB_Sync[Sync with Task Magic]
    TM_Update --> TM_Sync[Sync with Memory Bank]
    Rules_Update --> Rules_Apply[Apply in Future Sessions]
    
    MB_Sync --> Consistent[Maintain Consistency]
    TM_Sync --> Consistent
    Rules_Apply --> Improved[Improved AI Behavior]
```

## Key Operational Principles

### 1. Mode-First Approach
- **ALWAYS determine Plan vs Act mode FIRST** before any action
- **Strictly enforce mode restrictions** - no exceptions
- **Plan Mode = Documentation Only, Act Mode = Implementation Only**

### 2. Memory-First Approach
- **Always read Memory Bank files first** at session start
- **Memory Bank drives all operations** with Task Magic providing support
- **Context preservation** is critical for effective AI operation

### 3. Unified Command Processing
- **Single entry point** through Memory Bank system
- **Automatic synchronization** between systems
- **Consistent state** maintained across all operations

### 4. Continuous Learning
- **Pattern recognition** and documentation in .cursor/rules
- **Project intelligence** accumulation over time
- **Adaptive behavior** based on learned patterns

### 5. Quality Assurance
- **Mandatory file reviews** for critical operations
- **Consistency checks** between systems
- **Error recovery** mechanisms built-in

## CRITICAL MODE ENFORCEMENT SUMMARY

🚨 **NEVER VIOLATE THESE RULES:**

**PLAN MODE** = Documentation & Design Only:
- ✅ Create .md files in .ai/plans/
- ✅ Generate diagrams and specifications  
- ✅ Write PRDs and technical documentation
- 🚫 **NEVER create .py/.js/.ts or any code files**
- 🚫 **NEVER run code or install packages**

**ACT MODE** = Implementation & Execution:
- ✅ Create source code files
- ✅ Run commands and install dependencies
- ✅ Implement functionality and fix bugs
- 🚫 Should not create new plans without explicit request

**When in doubt: ASK THE USER which mode they want!**

This unified workflow ensures reliable, consistent, and intelligent AI agent operation with persistent memory and continuous improvement capabilities. 