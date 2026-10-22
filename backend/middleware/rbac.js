/**
 * Role-Based Access Control middleware.
 * Usage: router.post('/route', authenticate, authorize('Teacher'), handler)
 * Satisfies: OEP-F-004, OEP-SR-001
 *
 * Role hierarchy:
 *  - Student: can only access /api/attempt/* and view published exams
 *  - Teacher: can access /api/questions/*, /api/exams/*, /api/grading/*
 *  - Admin:   can access /api/admin/* and all other routes
 *
 * RBAC is enforced server-side on every protected route — never UI-only.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        },
      });
    }

    next();
  };
}

module.exports = { authorize };
