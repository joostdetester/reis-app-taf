@mobile @ui
Feature: Mobile layout

  As a family member using the trip app on their phone
  I want the fixed bottom navigation to respond to a real touch tap and never hide page content
  So that I can actually reach every page and read everything on a small screen

  @touch @risk-high
  Scenario: Tapping through the bottom navigation and header menu reaches every section
    Given the user opens the today page
    When the user taps through every main section
    Then each section is shown in turn

  @risk-high
  Scenario: The floating bottom navigation does not cover the page's content
    Given the user opens the practical information page
    And the practical information page has finished loading
    When the user scrolls to the bottom of the page
    Then the bottom navigation does not overlap the page content
