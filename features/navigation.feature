@ui @smoke
Feature: Main navigation

  As a family member using the trip app
  I want to move between the main sections
  So that I can find trip information quickly

  Scenario: The bottom navigation opens every main section
    Given the user opens the today page
    When the user navigates to the trip overview
    Then the trip overview is visible
    When the user navigates to the hotels page
    Then the hotels overview is visible
    When the user navigates to the flights page
    Then the flights overview is visible
    When the user navigates back to the today page
    Then the today page is visible

  Scenario: The extra menu opens photos and practical information
    Given the user opens the today page
    When the user opens the photos page from the extra menu
    Then the photos page is visible
    When the user opens the practical information page from the extra menu
    Then the practical information page is visible

  @e2e
  Scenario: Visiting every main page produces no console errors
    Given the user opens the today page
    When the user visits every main page in sequence
    Then no console errors should have occurred
