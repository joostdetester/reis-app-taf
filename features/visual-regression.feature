@visual @ui
Feature: Visual regression

  As a family member using the trip app
  I want the app's layout to stay visually consistent
  So that an unintended CSS/layout change gets caught before it reaches everyone

  Scenario: Today page appearance is unchanged
    Given the user opens the today page
    Then the today page matches its visual baseline

  Scenario: Trip overview destinations view appearance is unchanged
    Given the user opens the trip overview page
    When the user switches to the destinations view
    Then the trip overview page matches its visual baseline

  Scenario: Hotels page appearance is unchanged
    Given the user opens the hotels page
    Then the hotels page matches its visual baseline

  Scenario: Flights page appearance is unchanged
    Given the user opens the flights page
    Then the flights page matches its visual baseline

  Scenario: Practical information page appearance is unchanged
    Given the user opens the practical information page
    And the practical information page has finished loading
    Then the practical information page matches its visual baseline
