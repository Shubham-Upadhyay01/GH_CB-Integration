@ADS-USER-001
@CB-173785
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

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter invalid credentials
    And I click the login button
    Then I should see an error message
    And I should remain on the login page

  Scenario: Logout functionality
    Given I am logged in to the application
    When I click the logout button
    Then I should be redirected to the login page
    And my session should be terminated

@ADS-USER-002
@CB-176550
@Safety
Feature: Emergency Stop System
  As a system operator
  I want to have an emergency stop function
  So that I can immediately halt operations in case of danger

  Scenario: Emergency stop activation
    Given the system is running normally
    When I press the emergency stop button
    Then all operations should halt immediately
    And safety protocols should be activated

@ADS-USER-003
@CB-145013
@Security
@Safety
Feature: Secure Data Transmission
  As a system administrator
  I want all data to be encrypted during transmission
  So that sensitive information remains protected

  Scenario: Encrypted data transfer
    Given a secure connection is established
    When data is transmitted
    Then the data should be encrypted
    And integrity checks should be performed 