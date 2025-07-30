@ADS-TEST-INTEGRATION-001
@Security
Feature: Test GitHub to Codebeamer Integration
  As a developer
  I want to test the automatic requirement creation
  So that I can verify the integration is working correctly

  Background:
    Given the GitHub repository has the integration configured
    And Codebeamer is accessible via API
    And all GitHub secrets are properly set

  Scenario: Successful requirement creation
    Given I create a feature file with an @ADS tag
    When I submit a pull request with this feature file
    And the pull request gets approved
    Then a new requirement should be created in Codebeamer tracker 20536
    And the requirement should have all fields populated correctly
    And the feature file should be updated with a @CB- tag

  Scenario: Validate field mappings
    Given the requirement is created in Codebeamer
    When I check the requirement details
    Then the Rationale field should contain "@ADS-TEST-INTEGRATION-001"
    And the Title should be "Test GitHub to Codebeamer Integration"
    And the Description should contain the full feature description
    And the Acceptance Criteria should contain both scenarios
    And the Security field should be set to "Yes"
    And the Safety field should be set to "No"
    And the POF field should be set to "Yes" 