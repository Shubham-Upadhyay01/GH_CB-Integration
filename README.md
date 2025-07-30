# GitHub to Codebeamer Integration

This GitHub Action automatically creates requirements in Codebeamer when PR is approved, based on Gherkin feature files with ADS User Story ID tags.

## Overview

When a Pull Request is approved or merged, this integration:

1. **Scans** changed `.feature` files for requirements tagged with `@ADS-` IDs
2. **Creates** new UserStory requirements in Codebeamer for untagged requirements
3. **Updates** the feature files with returned Codebeamer requirement IDs (`@CB-` tags)
4. **Commits** the updated files back to the PR branch

## Setup Instructions

### 1. Configure GitHub Secrets

Add the following secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `CODEBEAMER_API_URL` | Your Codebeamer instance URL | `https://www.sandbox.codebeamer.plm.philips.com/cb/rest` |
| `CODEBEAMER_USERNAME` | API username | `Shubham.Upadhyay` |
| `CODEBEAMER_PASSWORD` | API password | `cbpass` |
| `CODEBEAMER_PROJECT_ID` | Target project ID | `6` |
| `CODEBEAMER_TRACKER_ID` | Product Requirements tracker ID | `20536` |

### 2. Feature File Format

Your Gherkin feature files should follow this format:

```gherkin
@ADS-USER-001
@Security
Feature: User Authentication
  As a user of the application
  I want to be able to log in and log out
  So that I can access my personal information securely

  Background:
    Given the application is running
    And the user database is available

  Scenario: Successful login
    Given I am on the login page
    When I enter valid credentials
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see my username displayed
```

**Tag Usage:**
- `@ADS-*` tags are **required** for requirement identification
- `@Security` tag sets Security field to "Yes" in Codebeamer
- `@Safety` tag sets Safety field to "Yes" in Codebeamer  
- Multiple tags can be combined (e.g., `@Security @Safety`)

### 3. After Integration

After the integration runs, your feature file will be updated with Codebeamer IDs:

```gherkin
@ADS-USER-001
@CB-142601
Feature: User Authentication
  As a user of the application
  I want to be able to log in and log out
  So that I can access my personal information securely
```

## How It Works

### Trigger Events
- **PR Review Approved**: When a reviewer approves a PR
- **PR Merged**: When a PR is successfully merged

### File Processing
1. Identifies all modified/added `.feature` files in the PR
2. Parses each file for `@ADS-` tagged requirements
3. Skips requirements that already have `@CB-` tags
4. Creates new requirements in Codebeamer for untagged ones

### Codebeamer Payload
The integration sends the following data to Codebeamer:

```json
{
  "name": "Feature title from Gherkin",
  "description": "Feature description and background",
  "tracker": {
    "id": 20536
  },
  "customFields": [
    {
      "name": "Rationale",
      "value": "@ADS-USER-001"
    },
    {
      "name": "Acceptance Criteria",
      "value": "All scenarios combined"
    },
    {
      "name": "POF",
      "value": "Yes"
    },
    {
      "name": "Safety",
      "value": "No"
    },
    {
      "name": "Security",
      "value": "Yes"
    }
  ]
}
```

## Field Mapping

Based on your Codebeamer field configuration:

| GitHub/Gherkin Source | Codebeamer Field | Implementation | Notes |
|----------------------|------------------|----------------|-------|
| @ADS-* tag | Rationale | Maps ADS User Story ID | Required field for traceability |
| Feature title | Title (name) | From `Feature:` line | Basic requirement title |
| Feature description + Background | Description | Combined text content | Feature description and background |
| All Scenarios | Acceptance Criteria | All scenarios joined | BDD scenarios as acceptance criteria |
| Feature file existence | POF | "Yes" if in feature file | Proof of Feature field |
| @Safety tag | Safety | "Yes" if @Safety tag present | Safety field with Yes/No option |
| @Security tag | Security | "Yes" if @Security tag present | Security field with Yes/No option |

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify `CODEBEAMER_USERNAME` and `CODEBEAMER_PASSWORD`
   - Ensure the user has permissions to create items in the specified tracker

2. **Tracker Not Found**
   - Verify `CODEBEAMER_TRACKER_ID` exists and is accessible
   - Check `CODEBEAMER_PROJECT_ID` is correct

3. **No Requirements Created**
   - Ensure `.feature` files contain `@ADS-` tags
   - Check that files were actually changed in the PR
   - Verify the PR was approved or merged

4. **API Endpoint Issues**
   - Confirm `CODEBEAMER_API_URL` format: `https://www.sandbox.codebeamer.plm.philips.com/cb/rest`
   - Test API connectivity using provided Postman collection

### Debug Mode

To enable detailed logging, check the GitHub Action logs under the "Run Codebeamer Integration" step.

## API Testing

You mentioned having a Postman collection for API testing. To help refine the integration, please provide:

1. **Codebeamer API endpoints** you've tested
2. **Payload structures** that work in Postman
3. **Field mappings** specific to your Codebeamer instance
4. **Authentication details** (format, headers, etc.)

## Next Steps

1. **Test the integration** with a sample PR
2. **Provide Postman collection** for API refinement
3. **Validate field mappings** match your Codebeamer setup
4. **Configure custom fields** if needed (ADS_ID, etc.)

## Future Enhancements

- Update existing requirements when feature files are modified
- Delete/deactivate requirements when removed from feature files
- Support for different requirement types beyond UserStory
- Integration with Windchill for document generation 