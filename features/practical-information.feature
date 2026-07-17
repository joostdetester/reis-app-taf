@ui @practical
Feature: Practical information

  As a family member using the trip app
  I want weather, currency conversion and key local information in one place
  So that I don't need to look it up elsewhere while travelling

  @external-api @risk-low
  Scenario: Switching city in the weather selector shows that city's 14-day forecast
    Given the user opens the practical information page
    When the user selects a different city in the weather selector
    Then the 14-day weather forecast for that city is shown

  @risk-high
  Scenario: Entering an amount in Peso recalculates the Euro amount
    Given the user opens the practical information page
    When the user enters an amount in the Peso field
    Then the Euro field shows the correctly converted amount

  @risk-high
  Scenario: Entering an amount in Euro recalculates the Peso amount
    Given the user opens the practical information page
    When the user enters an amount in the Euro field
    Then the Peso field shows the correctly converted amount

  @external-api @risk-low
  Scenario: The displayed exchange-rate date matches today's date
    Given the user opens the practical information page
    Then the exchange rate date shown next to the converter matches today's date

  @risk-low
  Scenario: The static info blocks show the expected practical content
    Given the user opens the practical information page
    Then the emergency information block is shown
    And the money information block is shown
    And the transport information block is shown
    And the getting-there information block is shown
