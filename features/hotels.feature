@ui @hotels
Feature: Hotels

  As a family member using the trip app
  I want to see full booking details for every hotel
  So that I can check in, get in touch, or find the hotel without digging through email

  @smoke @critical
  Scenario: The hotels list shows booking details for every hotel
    Given the user opens the hotels page
    Then every hotel shows its name
    And every hotel shows its stay dates
    And every hotel shows its check-in and check-out times
    And every hotel shows its address
    And every hotel shows its phone number
    And every hotel shows its booking number

  @risk-low
  Scenario: Each hotel links to its location on Google Maps
    Given the user opens the hotels page
    Then each hotel shows an "Open in Google Maps" link for its address

  @risk-low
  Scenario: Each hotel links to its Booking.com page
    Given the user opens the hotels page
    Then each hotel shows a "View on Booking.com" link
