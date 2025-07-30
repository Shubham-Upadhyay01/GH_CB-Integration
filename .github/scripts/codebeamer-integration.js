const { Octokit } = require('@octokit/rest');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

class CodebeamerIntegration {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    this.codebeamerConfig = {
      apiUrl: process.env.CODEBEAMER_API_URL || 'https://www.sandbox.codebeamer.plm.philips.com/cb/rest',
      username: process.env.CODEBEAMER_USERNAME,
      password: process.env.CODEBEAMER_PASSWORD,
      projectId: process.env.CODEBEAMER_PROJECT_ID || '6',
      trackerId: process.env.CODEBEAMER_TRACKER_ID
    };

    this.context = {
      owner: process.env.GITHUB_REPOSITORY.split('/')[0],
      repo: process.env.GITHUB_REPOSITORY.split('/')[1],
      prNumber: this.getPRNumber()
    };
  }

  getPRNumber() {
    // Get PR number from GitHub event
    if (process.env.GITHUB_EVENT_NAME === 'pull_request_review') {
      return JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).pull_request.number;
    } else if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
      return JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).number;
    }
    return null;
  }

  async getChangedFiles() {
    try {
      const { data: files } = await this.octokit.pulls.listFiles({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.prNumber
      });

      // Filter for .feature files
      return files
        .filter(file => file.filename.endsWith('.feature'))
        .filter(file => file.status === 'added' || file.status === 'modified');
    } catch (error) {
      console.error('Error getting changed files:', error);
      return [];
    }
  }

  parseGherkinFile(content) {
    const lines = content.split('\n');
    const requirements = [];
    let currentRequirement = null;
    let inScenario = false;
    let scenarioContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for ADS User Story ID tag (e.g., @ADS-123)
      if (line.startsWith('@ADS-')) {
        // Save previous requirement if exists
        if (currentRequirement) {
          if (inScenario && scenarioContent.length > 0) {
            currentRequirement.scenarios.push(scenarioContent.join('\n'));
          }
          requirements.push(currentRequirement);
        }
        
        // Start new requirement
        currentRequirement = {
          adsId: line,
          lineNumber: i + 1,
          scenarios: [],
          description: '',
          acceptanceCriteria: [],
          codebeamerId: null,
          tags: [] // Store additional tags like @Security, @Safety
        };
        inScenario = false;
        scenarioContent = [];
        continue;
      }

      // Check for existing Codebeamer ID tag (e.g., @CB-142600)
      if (line.startsWith('@CB-')) {
        if (currentRequirement) {
          currentRequirement.codebeamerId = line.replace('@CB-', '');
        }
        continue;
      }

      // Check for other tags (Security, Safety, etc.)
      if (line.startsWith('@') && currentRequirement && !line.startsWith('@ADS-') && !line.startsWith('@CB-')) {
        currentRequirement.tags.push(line);
        continue;
      }

      // Feature description
      if (line.startsWith('Feature:') && currentRequirement) {
        currentRequirement.title = line.replace('Feature:', '').trim();
        continue;
      }

      // Scenario parsing - end previous scenario when new one starts
      if ((line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) && currentRequirement) {
        if (inScenario && scenarioContent.length > 0) {
          currentRequirement.scenarios.push(scenarioContent.join('\n'));
        }
        inScenario = true;
        scenarioContent = [line];
        continue;
      }

      // Add content to current scenario or description
      if (currentRequirement) {
        if (inScenario) {
          scenarioContent.push(line);
        } else if (line && !line.startsWith('Feature:')) {
          // Add to description if not in scenario and not a feature line
          currentRequirement.description += line + '\n';
        }
      }
    }

    // Add the last requirement
    if (currentRequirement) {
      if (inScenario && scenarioContent.length > 0) {
        currentRequirement.scenarios.push(scenarioContent.join('\n'));
      }
      requirements.push(currentRequirement);
    }

    return requirements;
  }

  async createCodebeamerRequirement(requirement) {
    try {
      const auth = Buffer.from(`${this.codebeamerConfig.username}:${this.codebeamerConfig.password}`).toString('base64');
      
      // Prepare acceptance criteria from scenarios
      const acceptanceCriteria = requirement.scenarios.join('\n\n');
      
      // Build the payload according to your field mappings
      const payload = {
        // Basic item fields
        name: requirement.title || `Requirement from ${requirement.adsId}`,
        tracker: {
          id: parseInt(this.codebeamerConfig.trackerId)
        },
        
        // Required fields based on your mapping
        description: requirement.description.trim() || `Requirement extracted from ${requirement.adsId}`,
        
        // Custom fields based on your Codebeamer field mappings from UI screenshot
        customFields: [
          {
            // Rationale field - stores ADS User Story ID
            name: "Rationale",
            value: requirement.adsId
          },
          {
            // Acceptance Criteria field - stores BDD scenarios
            name: "Acceptance Criteria", 
            value: acceptanceCriteria
          },
          {
            // POF field (Yes/No option based on Feature file existence)
            name: "POF",
            value: "Yes" // Since requirement exists in Feature file
          },
          {
            // Safety field (Yes/No option based on Feature file tags)
            name: "Safety", 
            value: this.checkFeatureTag(requirement, '@Safety') ? "Yes" : "No"
          },
          {
            // Security field (Yes/No option based on Feature file tags)
            name: "Security",
            value: this.checkFeatureTag(requirement, '@Security') ? "Yes" : "No"
          }
        ]
      };

      console.log('Creating Codebeamer requirement with field mappings:', JSON.stringify(payload, null, 2));

      const response = await axios.post(
        `${this.codebeamerConfig.apiUrl}/items`,
        payload,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log('Codebeamer requirement created:', response.data);
      return response.data.id;
    } catch (error) {
      console.error('Error creating Codebeamer requirement:', error.response?.data || error.message);
      if (error.response?.data) {
        console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  // Helper method to check for specific tags in the requirement content
  checkFeatureTag(requirement, tag) {
    return requirement.tags && requirement.tags.includes(tag);
  }

  async updateFeatureFileWithId(filePath, requirement, codebeamerId) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Find the line with the ADS ID and add Codebeamer ID after it
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === requirement.adsId) {
          // Check if CB tag already exists on next line
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith('@CB-')) {
            lines[i + 1] = `@CB-${codebeamerId}`;
          } else {
            lines.splice(i + 1, 0, `@CB-${codebeamerId}`);
          }
          break;
        }
      }

      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`Updated ${filePath} with Codebeamer ID: ${codebeamerId}`);
    } catch (error) {
      console.error('Error updating feature file:', error);
      throw error;
    }
  }

  async commitAndPushChanges(updatedFiles) {
    try {
      // Configure git
      await this.runCommand('git config user.name "Codebeamer Integration"');
      await this.runCommand('git config user.email "action@github.com"');

      // Add all updated files
      for (const file of updatedFiles) {
        await this.runCommand(`git add "${file}"`);
      }

      // Commit changes
      await this.runCommand('git commit -m "Add Codebeamer requirement IDs to feature files"');
      
      // Push to the PR branch
      const branchName = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
      await this.runCommand(`git push origin HEAD:${branchName}`);

      console.log('Successfully pushed Codebeamer IDs to feature files');
    } catch (error) {
      console.error('Error committing changes:', error);
      // Don't throw - this is not critical to fail the whole process
    }
  }

  async runCommand(command) {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async run() {
    try {
      console.log('Starting Codebeamer integration...');
      console.log('PR Number:', this.context.prNumber);

      if (!this.context.prNumber) {
        console.log('No PR number found, skipping integration');
        return;
      }

      const changedFiles = await this.getChangedFiles();
      console.log('Changed feature files:', changedFiles.map(f => f.filename));

      if (changedFiles.length === 0) {
        console.log('No .feature files changed, skipping integration');
        return;
      }

      const updatedFiles = [];

      for (const file of changedFiles) {
        console.log(`Processing file: ${file.filename}`);
        
        if (!fs.existsSync(file.filename)) {
          console.log(`File ${file.filename} not found in workspace, skipping`);
          continue;
        }

        const content = fs.readFileSync(file.filename, 'utf8');
        const requirements = this.parseGherkinFile(content);

        console.log(`Found ${requirements.length} requirements in ${file.filename}`);

        for (const requirement of requirements) {
          console.log(`Processing requirement: ${requirement.adsId}`);
          
          // Skip if already has Codebeamer ID
          if (requirement.codebeamerId) {
            console.log(`Requirement ${requirement.adsId} already has Codebeamer ID: ${requirement.codebeamerId}`);
            continue;
          }

          try {
            const codebeamerId = await this.createCodebeamerRequirement(requirement);
            await this.updateFeatureFileWithId(file.filename, requirement, codebeamerId);
            updatedFiles.push(file.filename);
            
            console.log(`Successfully created requirement ${codebeamerId} for ${requirement.adsId}`);
          } catch (error) {
            console.error(`Failed to process requirement ${requirement.adsId}:`, error.message);
            // Continue with other requirements
          }
        }
      }

      if (updatedFiles.length > 0) {
        await this.commitAndPushChanges(updatedFiles);
      }

      console.log('Codebeamer integration completed successfully');
    } catch (error) {
      console.error('Error in Codebeamer integration:', error);
      process.exit(1);
    }
  }
}

// Export for testing
module.exports = { CodebeamerIntegration };

// Run the integration only if this file is executed directly
if (require.main === module) {
  const integration = new CodebeamerIntegration();
  integration.run();
} 