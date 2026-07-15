@ui @today
Feature: Today page

  As a family member using the trip app
  I want today's day card to summarize the day at a glance
  So that I can quickly see where we are, what the weather is like and what's planned

  Scenario: The day card shows destination, date, weather and beach score for today
    Given the user opens the today page
    Then the day card for today shows the destination
    And the day card for today shows the date
    And the day card for today shows a weather forecast
    And the day card for today shows a beach score

  Scenario: The day card summarizes that day's flight and hotel
    Given the user opens the today page
    Then the day card shows a summary of that day's flight, when a flight is scheduled
    And the day card shows a summary of that day's hotel, when a hotel is booked

  Scenario: Each part of the day shows its planned activity
    Given the user opens the today page
    Then the morning part of the day shows its planned activity
    And the afternoon part of the day shows its planned activity
    And the evening part of the day shows its planned activity

  Scenario: The note field shows a placeholder when no note has been added for a day
    Given the user opens the today page
    When today's day card has no note entered
    Then the note field shows the placeholder text "Geen notitie"

  Scenario: The Google Maps link on the day card points to the correct location
    Given the user opens the today page
    Then the "Open location in Google Maps" link for today's card contains the destination as a search query

  Scenario: Clicking the flight summary navigates to the flight detail page
    Given the user opens the today page
    And today's day card shows a flight summary
    When the user clicks the flight summary
    Then the flights page opens showing that flight's details

  Scenario: Clicking the hotel summary navigates to the hotel detail page
    Given the user opens the today page
    And today's day card shows a hotel summary
    When the user clicks the hotel summary
    Then the hotels page opens showing that hotel's details

  Scenario: The header shows a countdown, the current time and the next upcoming flight
    Given the user opens the today page
    Then the header shows a countdown to the trip or shows that the trip has started
    And the header shows the current time
    And the header shows the next upcoming flight, when one is scheduled
