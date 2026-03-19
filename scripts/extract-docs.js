import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'docs');

// Get WEED_PATH from environment variable or clone from git
function getWeedPath() {
  const envPath = process.env.WEED_PATH;

  // Download from zip if not exists
  const extractedPath = path.join(__dirname, '..', 'seaweedfs-master');

  if (envPath) {
    if (fs.existsSync(envPath)) {
      console.log('Using WEED_PATH:', envPath);
      return envPath;
    } else {
      console.log('WEED_PATH is set but directory does not exist:', envPath);
      console.log('Falling back to download from GitHub...');
    }
  }

  if (!fs.existsSync(extractedPath)) {
    const zipPath = path.join(__dirname, '..', 'temp-weed.zip');
    console.log('Downloading SeaweedFS from GitHub...');
    execSync(`curl -# -L -o "${zipPath}" https://github.com/seaweedfs/seaweedfs/archive/refs/heads/master.zip`, { stdio: 'inherit' });
    console.log('\nExtracting...');
    execSync(`unzip -o "${zipPath}" -d "${path.dirname(extractedPath)}"`, { stdio: 'inherit' });
    fs.unlinkSync(zipPath);
  }
  console.log('Using downloaded SeaweedFS:', extractedPath);
  return path.join(extractedPath, 'weed');
}

const WEED_PATH = getWeedPath();

// Parse a command .go file to extract command info
function parseCommandFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.go');

    // Extract command name from UsageLine
    const usageMatch = content.match(/UsageLine\s+"([^"]+)"/);
    const usageLine = usageMatch ? usageMatch[1] : fileName;

    // Extract Short description
    const shortMatch = content.match(/Short:\s+"([^"]+)"/);
    const short = shortMatch ? shortMatch[1] : '';

    // Extract Long description
    const longMatch = content.match(/Long:\s+`([^`]+)`/s);
    const long = longMatch ? longMatch[1].trim() : '';

    // Extract flags from init() function
    const flags = [];
    const flagPattern = /(\w+)\s*=\s*cmd\w+\.Flag\.(Int|String|Bool|Float|Int64|Uint64)\("([^"]+)",\s*([^,]+),\s*"([^"]+)"\)/g;
    let match;
    while ((match = flagPattern.exec(content)) !== null) {
        flags.push({
            name: match[3],
            type: match[2],
            defaultValue: match[4],
            description: match[5]
        });
    }

    return {
        name: usageLine.split(' ')[0],
        usageLine,
        short,
        long,
        flags,
        source: `command/${fileName}.go`
    };
}

// Get all command files
function getCommandFiles() {
    const commandDir = path.join(WEED_PATH, 'command');
    const files = fs.readdirSync(commandDir);
    return files
        .filter(f => f.endsWith('.go') && f !== 'command.go' && f !== 'imports.go')
        .map(f => path.join(commandDir, f));
}

// Parse shell command files
function parseShellCommandFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.go');

    // Extract command name
    const nameMatch = content.match(/func\s+\(\w+\s+\*command\w+\)\s+Name\(\)\s+string\s*\{\s*return\s+"([^"]+)"\s*\}/);
    const name = nameMatch ? nameMatch[1] : fileName.replace('command_', '').replace('.go', '');

    // Extract Help text
    const helpMatch = content.match(/func\s+\(\w+\s+\*command\w+\)\s+Help\(\)\s+string\s*\{\s*return\s+`([^`]+)`/s);
    const help = helpMatch ? helpMatch[1].trim() : '';

    // Extract flags from Do function - handle both flag.X() and variable.X() patterns
    const flags = [];

    // Match Bool flags: variable.Bool("name", default, "description") or flag.Bool("name", default, "description")
    const boolPattern = /\w+\.Bool\("([^"]+)",\s*(false|true),\s*"([^"]+)"\)/g;
    // Match Int flags: variable.Int("name", default, "description")
    const intPattern = /\w+\.Int\("([^"]+)",\s*([^,]+),\s*"([^"]+)"\)/g;
    // Match String flags: variable.String("name", "default", "description")
    const stringPattern = /\w+\.String\("([^"]+)",\s*"([^"]*)",\s*"([^"]+)"\)/g;
    // Match Uint64 flags: variable.Uint64("name", default, "description")
    const uint64Pattern = /\w+\.Uint64\("([^"]+)",\s*([^,]+),\s*"([^"]+)"\)/g;
    // Match Uint flags: variable.Uint("name", default, "description")
    const uintPattern = /\w+\.Uint\("([^"]+)",\s*([^,]+),\s*"([^"]+)"\)/g;
    // Match Float64 flags: variable.Float64("name", default, "description")
    const float64Pattern = /\w+\.Float64\("([^"]+)",\s*([^,]+),\s*"([^"]+)"\)/g;

    let match;

    // Reset lastIndex before each pattern match
    boolPattern.lastIndex = 0;
    while ((match = boolPattern.exec(content)) !== null) {
        flags.push({
            name: match[1],
            type: 'bool',
            defaultValue: match[2],
            description: match[3]
        });
    }

    intPattern.lastIndex = 0;
    while ((match = intPattern.exec(content)) !== null) {
        flags.push({
            name: match[1],
            type: 'int',
            defaultValue: match[2],
            description: match[3]
        });
    }

    stringPattern.lastIndex = 0;
    while ((match = stringPattern.exec(content)) !== null) {
        flags.push({
            name: match[1],
            type: 'string',
            defaultValue: `"${match[2]}"`,
            description: match[3]
        });
    }

    uint64Pattern.lastIndex = 0;
    while ((match = uint64Pattern.exec(content)) !== null) {
        flags.push({
            name: match[1],
            type: 'uint64',
            defaultValue: match[2],
            description: match[3]
        });
    }

    uintPattern.lastIndex = 0;
    while ((match = uintPattern.exec(content)) !== null) {
        flags.push({
            name: match[1],
            type: 'uint',
            defaultValue: match[2],
            description: match[3]
        });
    }

    float64Pattern.lastIndex = 0;
    while ((match = float64Pattern.exec(content)) !== null) {
        flags.push({
            name: match[1],
            type: 'float64',
            defaultValue: match[2],
            description: match[3]
        });
    }

    return {
        name,
        help,
        flags,
        source: `shell/${fileName}`
    };
}

// Get shell command files
function getShellCommandFiles() {
    const shellDir = path.join(WEED_PATH, 'shell');
    const files = fs.readdirSync(shellDir);
    return files
        .filter(f => f.startsWith('command_') && f.endsWith('.go') && !f.includes('_test'))
        .map(f => path.join(shellDir, f));
}

// Main extraction
function extractDocs() {
    console.log('Extracting SeaweedFS command documentation...\n');

    const commands = getCommandFiles().map(parseCommandFile);
    const shellCommands = getShellCommandFiles().map(parseShellCommandFile);

    // Filter out non-runnable commands
    const runnableCommands = commands.filter(c => c.short || c.long);

    // Group shell commands by category
    const shellCategories = {};
    shellCommands.forEach(cmd => {
        const category = cmd.name.split('.')[0] || 'other';
        if (!shellCategories[category]) {
            shellCategories[category] = [];
        }
        shellCategories[category].push(cmd);
    });

    const docs = {
        commands: runnableCommands,
        shellCommands: shellCategories,
        extractedAt: new Date().toISOString()
    };

    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });

    // Write docs
    fs.writeFileSync(
        path.join(OUTPUT_PATH, 'commands.json'),
        JSON.stringify(docs, null, 2)
    );

    console.log(`Extracted ${runnableCommands.length} main commands`);
    console.log(`Extracted ${shellCommands.length} shell commands`);
    console.log(`Shell command categories: ${Object.keys(shellCategories).join(', ')}`);
    console.log(`\nDocumentation saved to ${OUTPUT_PATH}/commands.json`);
}

// Run extraction
extractDocs();
