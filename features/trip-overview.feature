@ui @trip
Feature: Trip overview

  As a family member using the trip app
  I want to browse the whole trip in different ways
  So that I can find what I'm looking for, however I like to look at it

  @critical
  Scenario: The timeline view shows all trip days in chronological order
    Given the user opens the trip overview page
    Then the timeline view is shown by default
    And the trip days are listed in chronological order

  @risk-high
  Scenario: Switching to the destinations view groups days by destination
    Given the user opens the trip overview page
    When the user switches to the destinations view
    Then the trip days are grouped per destination

  @risk-high
  Scenario: Switching to the calendar view shows a compact date-to-destination list
    Given the user opens the trip overview page
    When the user switches to the calendar view
    Then a compact list of dates and destinations is shown

  @risk-low
  Scenario: The selected trip view is kept after a page refresh
    Given the user opens the trip overview page
    And the user switches to the destinations view
    When the user refreshes the page
    Then the destinations view is still shown

  @risk-low
  Scenario: A destination shows a link to its GetYourGuide activities
    Given the user opens the trip overview page
    When the user switches to the destinations view
    Then each destination shows a "Top activities on GetYourGuide" link for that destination

  @risk-high
  Scenario: Searching for a valid term filters the timeline live
    Given the user opens the trip overview page
    When the user searches for "El Nido"
    Then only the days matching "El Nido" remain visible in the timeline
