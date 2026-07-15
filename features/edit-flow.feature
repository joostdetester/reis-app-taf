@ui @edit-flow
Feature: Edit flow

  As a family member using the trip app
  I want editing to be restricted to people with a valid edit link
  So that the shared trip data can't be changed by mistake

  Scenario: View-only mode shows a read-only badge and no edit buttons
    Given the user opens the today page without an edit token
    Then a read-only badge is shown
    And no edit buttons are shown

  Scenario: A valid edit token shows a logout button and edit buttons
    Given the user opens the app with a valid edit token
    Then a logout button is shown
    And an edit button is shown for each part of the day
    And an edit button is shown for the note

  Scenario Outline: Clicking edit opens the matching inline form for the <part> part of the day
    Given the user opens the app with a valid edit token
    When the user clicks the edit button for the <part> part of the day
    Then an inline form titled "<title> bewerken" is shown

    Examples:
      | part      | title   |
      | morning   | Ochtend |
      | afternoon | Middag  |
      | evening   | Avond   |

  Scenario: Cancel closes the inline form without applying changes
    Given the user opens the app with a valid edit token
    And the user opened the inline edit form for the morning part of the day
    When the user types a change into the form
    And the user clicks cancel
    Then the form is closed
    And the morning part of the day still shows its original value
