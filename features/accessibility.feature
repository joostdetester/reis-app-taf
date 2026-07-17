@accessibility @a11y @ui
Feature: Accessibility

  Scenario Outline: Today page meets WCAG level <level>
    Given the user opens the today page
    Then the page meets WCAG level <level>

    Examples:
      | level |
      | A     |
      | AA    |
      | AAA   |

  Scenario Outline: Trip overview page meets WCAG level <level>
    Given the user opens the trip overview page
    Then the page meets WCAG level <level>

    Examples:
      | level |
      | A     |
      | AA    |
      | AAA   |

  Scenario Outline: Hotels page meets WCAG level <level>
    Given the user opens the hotels page
    Then the page meets WCAG level <level>

    Examples:
      | level |
      | A     |
      | AA    |
      | AAA   |

  Scenario Outline: Flights page meets WCAG level <level>
    Given the user opens the flights page
    Then the page meets WCAG level <level>

    Examples:
      | level |
      | A     |
      | AA    |
      | AAA   |

  Scenario Outline: Photos page meets WCAG level <level>
    Given the user opens the today page
    When the user opens the photos page from the extra menu
    Then the page meets WCAG level <level>

    Examples:
      | level |
      | A     |
      | AA    |
      | AAA   |

  Scenario Outline: Practical information page meets WCAG level <level>
    Given the user opens the practical information page
    Then the page meets WCAG level <level>

    Examples:
      | level |
      | A     |
      | AA    |
      | AAA   |
