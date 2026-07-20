@ui @photos
Feature: Photos

  As a family member using the trip app
  I want to see photos organized per trip day
  So that I can browse memories day by day

  @risk-low
  Scenario: A day without photos shows a placeholder message
    Given the user opens the photos page
    Then every day without photos shows the placeholder text "Nog geen foto's voor deze dag."
