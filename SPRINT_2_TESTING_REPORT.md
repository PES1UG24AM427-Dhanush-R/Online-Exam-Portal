\# Online Exam Portal – Sprint 2 Testing and Implementation Report



\## 1. Introduction



This report summarizes the testing, verification, and implementation activities completed for the Online Exam Portal during Sprint 2.



The project includes three user roles: Student, Teacher, and Admin. The testing work focused on validating functional requirements, non-functional requirements, security controls, backend modules, and system reliability.



The report also records recent implementation updates merged into the repository and identifies areas where further verification is still required.



\## 2. Functional Requirement Testing



The following functional requirement test suites were added and merged through GitHub pull requests.



| Requirement | Description | Test Result |

|---|---|---|

| OEP-F-001 to F-005 | Authentication, registration, login, account lockout, role-based access, and password reset | 5 test groups passed |

| OEP-F-006 to F-008 | Question creation, question types, filtering, editing, deletion, and ownership restrictions | 13/13 passed |

| OEP-F-009 to F-011 | Exam creation, validation, scheduling, and exam visibility | 20/20 passed |

| OEP-F-012 to F-013 | Exam timer, attempt resumption, and exam availability windows | 12/12 passed |

| OEP-F-014 | Automatic saving of answers every 60 seconds | Tested in Sprint 2 test suite |

| OEP-F-015 | Prevention of duplicate exam submissions | Tested in Sprint 2 test suite |

| OEP-F-016 | Automatic grading of MCQ and True/False questions | Independent verification pending |

| OEP-F-017 | Manual grading of Short Answer questions | Included in grading test suite |

| OEP-F-018 | Result release and Student result access | Included in grading test suite |

| OEP-F-019 to F-020 | Admin user management and Admin dashboard | 43 tests passed |



\### Additional Functional Implementation Updates



The following changes were merged through PR #50:



\- Added exam date validation during exam creation and updates.

\- Added question editing functionality.

\- Added Short Answer model-answer support in the Teacher question interface.

\- Added automatic expiry handling for timed-out exam attempts.

\- Updated SRS and SAD documentation to reflect implementation details and identified gaps.



\*\*Verification status for these updates:\*\*

\- JavaScript syntax checks passed.

\- Focused route validation checks passed.

\- Expiry sweeper stub tests passed.

\- Database-dependent tests and browser-level UI testing remain pending.



\## 3. Non-Functional Requirement Testing



| Requirement | Description | Result |

|---|---|---|

| OEP-NF-001 | Response time under load | Passed |

| OEP-NF-002 | Uptime monitoring and SLA verification | 8/8 passed |

| OEP-NF-003 | Concurrent request handling | 50 concurrent health requests passed |

| OEP-NF-004 | Safe error messages | 5 scenarios passed |

| OEP-NF-005 | Accessibility verification | 77/77 checks passed |



\### Performance Testing – OEP-NF-001



A load test was performed using 100 requests.



| Metric | Result |

|---|---:|

| Total Requests | 100 |

| Successful Requests | 100 |

| Failed Requests | 0 |

| Throughput | 550.13 requests/second |

| Mean Latency | 171.38 ms |

| 95th Percentile Latency | 201.21 ms |

| Maximum Latency | 265.08 ms |



The measured 95th percentile latency was below the 3000 ms response-time requirement.



\### Safe Error Handling – OEP-NF-004



Five scenarios were tested:



\- Invalid login credentials.

\- Invalid registration details.

\- Unauthenticated access.

\- Malformed JSON requests.

\- Requests to non-existent routes.



All five scenarios passed.



\### Accessibility – OEP-NF-005



\- 77 checks passed.

\- 11 HTML files were audited.



\### Uptime – OEP-NF-002



\- 8 checks passed.

\- Tests covered uptime, SLA status, maintenance scheduling, advance maintenance notice, and database persistence.



\## 4. Security Testing



Security testing was added through PR #49.



The test suite covered:



| Security Requirement | Description | Result |

|---|---|---|

| OEP-SR-001 | HTTPS communication, TLS negotiation, and HTTP-to-HTTPS redirection | Passed |

| OEP-SR-002 | Password hashing using bcrypt | Passed |

| OEP-SR-003 | JWT invalidation after logout | Passed |

| OEP-SR-004 | SQL injection and input validation protection | Passed |

| OEP-SR-005 | CSRF protection | Passed |

| OEP-NF-003 | Concurrent health-check requests | Passed |



\### Security Test Results



\- 7 checks passed.

\- 0 skipped.

\- 0 failed.

\- TLS 1.3 was successfully negotiated.

\- HTTP-to-HTTPS redirection was verified.

\- 50 concurrent health-check requests returned HTTP 200.



Local self-signed TLS certificates were used for testing. Private keys and local certificate files are excluded from version control. These certificates are intended for local testing, not production deployment.



\## 5. Continuous Integration



GitHub Actions CI integration was added through PR #44.



The workflow includes:



\- MySQL 8 database provisioning.

\- Database schema initialization.

\- Backend startup.

\- OEP-NF-001 load testing.

\- OEP-NF-004 safe-error testing.

\- Accessibility test execution.

\- Uptime test execution.

\- JavaScript syntax checks for test files.



The latest GitHub Actions run was reported as successful.



\## 6. Recent Repository Updates



The following additional pull requests were merged after the main Sprint 2 testing work.



\### PR #50 – Complete Person 1 and Person 2 Implementation Audit



\- Updated SRS and SAD documentation.

\- Added exam date validation for creation and updates.

\- Added question editing and Short Answer model-answer support.

\- Added automatic expiry handling for timed-out exam attempts.

\- Restored the original Student Dashboard requirement and documented identified implementation gaps.



Verification included JavaScript syntax checks, focused route validation checks, and expiry sweeper stub tests.



Database-dependent tests and browser-level UI testing remain pending.



\### PR #51 – Dashboard Fix



A dashboard-related fix was merged into the main branch on November 15, 2026.



The available pull request information identifies the change as a dashboard fix; this report does not assume additional implementation or test details beyond that.



\## 7. Merged Pull Requests



The following pull requests were merged into the repository:



| PR | Description |

|---|---|

| #41 | Sprint 2 automated test coverage, including auto-save and duplicate submission prevention |

| #42 | Authentication tests – F-001 to F-005 |

| #43 | Question Bank tests – F-006 to F-008 |

| #44 | CI integration and non-functional test execution |

| #45 | Exam Management tests – F-009 to F-011 |

| #46 | Exam Taking tests – F-012 to F-013 |

| #47 | Grading and Result Release tests – F-017 and F-018 |

| #48 | Admin tests – F-019, F-020 and NF-002 |

| #49 | Security and TLS verification |

| #50 | Person 1 and Person 2 implementation audit |

| #51 | Dashboard fix |



\## 8. Pending Verification and Known Gaps



The following items should not be considered fully verified yet:



1\. \*\*OEP-F-016 – Automatic Grading:\*\* Independent verification of MCQ and True/False automatic grading, including score persistence, remains pending.

2\. \*\*PR #50 implementation updates:\*\* Database-dependent tests and browser-level UI testing remain pending.

3\. \*\*Dashboard and results gaps:\*\* The implementation audit documented gaps concerning Student Dashboard exam visibility and the OEP-F-018 results dashboard. These should be checked against the requirements before being marked fully implemented.



\## 9. Conclusion



Sprint 2 included extensive automated testing across authentication, question management, exam management, exam taking, grading, administration, performance, accessibility, uptime, and security.



The test suites reported successful results across the areas listed in this report, and the CI integration was reported as passing. Additional implementation updates were also merged through PRs #50 and #51.



The remaining verification work, particularly OEP-F-016 automatic grading and the database-dependent and browser-level checks introduced by the implementation audit, should be completed before declaring all requirements fully verified.



\*\*Overall status:\*\* Major Sprint 2 testing and implementation work merged; a small number of verification items remain open.

