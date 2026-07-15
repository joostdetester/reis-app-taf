@ui @flights
Feature: Flights

  As a family member using the trip app
  I want full detail and live status links for every flight
  So that I can track it on travel day without hunting for the confirmation email

  @smoke
  Scenario: Each flight shows its flight number, times and duration
    Given the user opens the flights page
    Then every flight shows its flight number
    And every flight shows its departure and arrival times with time zone
    And every flight shows its flight duration

  Scenario: Each flight links to Flightradar24 for that flight number
    Given the user opens the flights page
    Then each flight shows a Flightradar24 link that matches its own flight number

  Scenario: Gate and terminal show a placeholder until close to departure
    Given the user opens the flights page
    Then a flight that departs more than a few hours from now shows a "not yet available" placeholder for its gate and terminal

  Scenario: Each flight has a route link to Google Maps directions
    Given the user opens the flights page
    Then each flight shows a route link to Google Maps directions between its departure and arrival locations
