@security @ui
Feature: Security

  As the family sharing this trip app
  I want basic security hygiene enforced (OWASP Top 10)
  So that a secret edit link or unexpected input can't leak data or run
  attacker-controlled code

  Scenario: OWASP A02 (Cryptographic Failures) - The edit token is not left visible in the address bar
    Given the user opens the app with a valid edit token
    Then the address bar no longer shows the edit token
    When the user reloads the page
    Then edit access is still available
    And the address bar still does not show the edit token

  Scenario: OWASP A03 (Injection) - The search field safely handles a script-injection payload
    Given the user opens the trip overview page
    When the user searches for a script-injection payload
    Then no dialog is triggered by the search
    And no day matches the payload

  Scenario: OWASP A05 (Security Misconfiguration) - The app response sets baseline security headers
    Given the user requests the app over HTTPS
    Then the response sets Strict-Transport-Security
    And the response sets Content-Security-Policy
    And the response sets X-Frame-Options
    And the response sets X-Content-Type-Options
