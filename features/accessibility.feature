@accessibility @a11y @ui
Feature: Today page accessibility

  Scenario Outline: Today page meets WCAG level <level>
    Given the user opens the today page
    Then the page meets WCAG level <level>

    Examples:
      | level |
      | A     |
      | AA    |
      | AAA   |
