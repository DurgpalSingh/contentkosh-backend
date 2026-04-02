/**
 * Centralized Swagger schema definitions
 * This file contains all shared schemas to avoid duplication across route files
 */

export const swaggerSchemas = {
  // Common Response Schemas
  ApiResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Request success status'
      },
      message: {
        type: 'string',
        description: 'Response message'
      },
      data: {
        type: 'object',
        description: 'Response data'
      },
      apiCode: {
        type: 'string',
        description: 'API response code'
      }
    }
  },
  ErrorResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: false
      },
      message: {
        type: 'string',
        description: 'Error message'
      },
      apiCode: {
        type: 'string',
        description: 'Error code'
      }
    }
  },

  // User Schemas
  CreateUserRequest: {
    type: 'object',
    required: ['name', 'email', 'password', 'role'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'User full name'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Valid email address'
      },
      mobile: {
        type: 'string',
        description: 'Mobile number'
      },
      password: {
        type: 'string',
        minLength: 6,
        description: 'Password (min 6 chars)'
      },
      role: {
        type: 'string',
        enum: ['ADMIN', 'TEACHER', 'STUDENT', 'USER'],
        description: 'User role'
      }
    }
  },
  UpdateUserRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'User full name'
      },
      mobile: {
        type: 'string',
        description: 'Mobile number'
      },
      role: {
        type: 'string',
        enum: ['ADMIN', 'TEACHER', 'STUDENT', 'USER'],
        description: 'User role'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'User status'
      }
    }
  },
  User: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'User ID'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address'
      },
      name: {
        type: 'string',
        description: 'User full name'
      },
      mobile: {
        type: 'string',
        description: 'Mobile number'
      },
      role: {
        type: 'string',
        enum: ['ADMIN', 'TEACHER', 'STUDENT', 'USER'],
        description: 'User role'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'User status'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'User creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'User last update timestamp'
      }
    }
  },
  RegisterRequest: {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address'
      },
      password: {
        type: 'string',
        minLength: 6,
        description: 'User password (minimum 6 characters)'
      },
      name: {
        type: 'string',
        minLength: 1,
        description: 'User full name'
      }
    }
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address'
      },
      password: {
        type: 'string',
        description: 'User password'
      }
    }
  },
  AuthResponse: {
    type: 'object',
    properties: {
      user: {
        $ref: '#/components/schemas/User'
      },
      token: {
        type: 'string',
        description: 'JWT authentication token'
      }
    }
  },
  BusinessUser: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Business User ID'
      },
      userId: {
        type: 'integer',
        description: 'User ID'
      },
      businessId: {
        type: 'integer',
        description: 'Business ID'
      },
      role: {
        type: 'string',
        enum: ['STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN'],
        description: 'User role in the business'
      },
      isActive: {
        type: 'boolean',
        description: 'Whether the business user is active'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Business user creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Business user last update timestamp'
      },
      user: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'User ID'
          },
          email: {
            type: 'string',
            description: 'User email'
          },
          name: {
            type: 'string',
            description: 'User name'
          }
        }
      },
      business: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Business ID'
          },
          instituteName: {
            type: 'string',
            description: 'Business institute name'
          }
        }
      }
    }
  },
  AssignUserToBusinessRequest: {
    type: 'object',
    required: ['userId', 'businessId', 'role'],
    properties: {
      userId: {
        type: 'integer',
        description: 'User ID to assign'
      },
      businessId: {
        type: 'integer',
        description: 'Business ID to assign user to'
      },
      role: {
        type: 'string',
        enum: ['STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN'],
        description: 'Role to assign to the user'
      }
    }
  },
  UpdateBusinessUserRequest: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN'],
        description: 'New role for the user'
      },
      isActive: {
        type: 'boolean',
        description: 'Whether the business user should be active'
      }
    }
  },

  // Business Schemas
  Business: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Business ID'
      },
      instituteName: {
        type: 'string',
        description: 'Name of the coaching institute'
      },
      logo: {
        type: 'string',
        description: 'URL or file path to the institute logo'
      },
      tagline: {
        type: 'string',
        description: 'Institute tagline or slogan'
      },
      contactNumber: {
        type: 'string',
        description: 'Contact phone number'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Contact email address'
      },
      address: {
        type: 'string',
        description: 'Physical address of the institute'
      },
      youtubeUrl: {
        type: 'string',
        description: 'YouTube channel URL'
      },
      instagramUrl: {
        type: 'string',
        description: 'Instagram profile URL'
      },
      linkedinUrl: {
        type: 'string',
        description: 'LinkedIn profile URL'
      },
      facebookUrl: {
        type: 'string',
        description: 'Facebook page URL'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Business creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Business last update timestamp'
      }
    }
  },
  CreateBusinessRequest: {
    type: 'object',
    required: ['instituteName'],
    properties: {
      instituteName: {
        type: 'string',
        minLength: 1,
        description: 'Name of the coaching institute (required)'
      },
      logo: {
        type: 'string',
        description: 'URL or file path to the institute logo'
      },
      tagline: {
        type: 'string',
        description: 'Institute tagline or slogan'
      },
      contactNumber: {
        type: 'string',
        description: 'Contact phone number'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Contact email address'
      },
      address: {
        type: 'string',
        description: 'Physical address of the institute'
      },
      youtubeUrl: {
        type: 'string',
        description: 'YouTube channel URL'
      },
      instagramUrl: {
        type: 'string',
        description: 'Instagram profile URL'
      },
      linkedinUrl: {
        type: 'string',
        description: 'LinkedIn profile URL'
      },
      facebookUrl: {
        type: 'string',
        description: 'Facebook page URL'
      }
    }
  },
  UpdateBusinessRequest: {
    type: 'object',
    properties: {
      instituteName: {
        type: 'string',
        minLength: 1,
        description: 'Name of the coaching institute'
      },
      logo: {
        type: 'string',
        description: 'URL or file path to the institute logo'
      },
      tagline: {
        type: 'string',
        description: 'Institute tagline or slogan'
      },
      contactNumber: {
        type: 'string',
        description: 'Contact phone number'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Contact email address'
      },
      address: {
        type: 'string',
        description: 'Physical address of the institute'
      },
      youtubeUrl: {
        type: 'string',
        description: 'YouTube channel URL'
      },
      instagramUrl: {
        type: 'string',
        description: 'Instagram profile URL'
      },
      linkedinUrl: {
        type: 'string',
        description: 'LinkedIn profile URL'
      },
      facebookUrl: {
        type: 'string',
        description: 'Facebook page URL'
      }
    }
  },

  // Exam Schemas
  Exam: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Exam ID'
      },
      name: {
        type: 'string',
        description: 'Name of the exam (e.g., UPSC, NEET)'
      },
      description: {
        type: 'string',
        description: 'Description of the exam'
      },
      status: {
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the exam'
      },
      code: {
        type: 'string',
        description: 'Unique code for the exam'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the exam'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the exam'
      },
      businessId: {
        type: 'integer',
        description: 'ID of the business this exam belongs to'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Exam creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Exam last update timestamp'
      },
      courses: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Course'
        },
        description: 'List of courses under this exam'
      }
    }
  },
  CreateExamRequest: {
    type: 'object',
    required: ['name', 'businessId'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'Name of the exam (required)'
      },
      description: {
        type: 'string',
        description: 'Description of the exam'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE',
        description: 'Status of the exam'
      },
      businessId: {
        description: 'ID of the business this exam belongs to (required)'
      },
      code: {
        type: 'string',
        description: 'Unique code for the exam'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the exam'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the exam'
      }
    }
  },
  UpdateExamRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'Name of the exam'
      },
      description: {
        type: 'string',
        description: 'Description of the exam'
      },
      status: {
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the exam'
      },
      code: {
        type: 'string',
        description: 'Unique code for the exam'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the exam'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the exam'
      }
    }
  },
  ExamWithCourses: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Exam ID'
      },
      name: {
        type: 'string',
        description: 'Name of the exam'
      },
      description: {
        type: 'string',
        description: 'Description of the exam'
      },
      status: {
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the exam'
      },
      code: {
        type: 'string',
        description: 'Unique code for the exam'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the exam'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the exam'
      },
      businessId: {
        type: 'integer',
        description: 'ID of the business this exam belongs to'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Exam creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Exam last update timestamp'
      },
      courses: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Course'
        },
        description: 'List of active courses under this exam'
      }
    }
  },

  // Course Schemas
  Course: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Course ID'
      },
      name: {
        type: 'string',
        description: 'Name of the course (e.g., Civil Services Course)'
      },
      description: {
        type: 'string',
        description: 'Description of the course'
      },
      duration: {
        type: 'string',
        description: 'Duration of the course (e.g., 6 months, 1 year)'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the course'
      },
      examId: {
        type: 'integer',
        description: 'ID of the exam this course belongs to'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Course creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Course last update timestamp'
      },
      subjects: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Subject'
        },
        description: 'List of subjects under this course'
      }
    }
  },
  CreateCourseRequest: {
    type: 'object',
    required: ['name', 'examId'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'Name of the course (required)'
      },
      description: {
        type: 'string',
        description: 'Description of the course'
      },
      duration: {
        type: 'string',
        description: 'Duration of the course (e.g., 6 months, 1 year)'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE',
        description: 'Status of the course'
      },
      examId: {
        type: 'integer',
        description: 'ID of the exam this course belongs to (required)'
      }
    }
  },
  UpdateCourseRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'Name of the course'
      },
      description: {
        type: 'string',
        description: 'Description of the course'
      },
      duration: {
        type: 'string',
        description: 'Duration of the course (e.g., 6 months, 1 year)'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the course'
      }
    }
  },
  CourseWithSubjects: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Course ID'
      },
      name: {
        type: 'string',
        description: 'Name of the course'
      },
      description: {
        type: 'string',
        description: 'Description of the course'
      },
      duration: {
        type: 'string',
        description: 'Duration of the course'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the course'
      },
      examId: {
        type: 'integer',
        description: 'ID of the exam this course belongs to'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Course creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Course last update timestamp'
      },
      subjects: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Subject'
        },
        description: 'List of active subjects under this course'
      }
    }
  },

  // Subject Schemas
  Subject: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Subject ID'
      },
      name: {
        type: 'string',
        description: 'Name of the subject (e.g., Geography, History, Physics)'
      },
      description: {
        type: 'string',
        description: 'Description of the subject'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the subject'
      },
      courseId: {
        type: 'integer',
        description: 'ID of the course this subject belongs to'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Subject creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Subject last update timestamp'
      }
    }
  },
  CreateSubjectRequest: {
    type: 'object',
    required: ['name', 'courseId'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'Name of the subject (required)'
      },
      description: {
        type: 'string',
        description: 'Description of the subject'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE',
        description: 'Status of the subject'
      },
      courseId: {
        type: 'integer',
        description: 'ID of the course this subject belongs to (required)'
      }
    }
  },
  UpdateSubjectRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'Name of the subject'
      },
      description: {
        type: 'string',
        description: 'Description of the subject'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the subject'
      }
    }
  },

  // Announcement Schemas
  Announcement: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Announcement ID'
      },
      heading: {
        type: 'string',
        description: 'Title of the announcement'
      },
      content: {
        type: 'string',
        description: 'Description of the announcement'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the announcement period'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the announcement period'
      },
      isActive: {
        type: 'boolean',
        description: 'Whether the announcement is active'
      },
      businessId: {
        type: 'integer',
        description: 'ID of the business this announcement belongs to'
      },
      visibleToAdmins: {
        type: 'boolean',
        description: 'Whether the announcement is visible to admins'
      },
      visibleToTeachers: {
        type: 'boolean',
        description: 'Whether the announcement is visible to teachers'
      },
      visibleToStudents: {
        type: 'boolean',
        description: 'Whether the announcement is visible to students'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Announcement creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Announcement last update timestamp'
      },
      business: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Business ID'
          },
          instituteName: {
            type: 'string',
            description: 'Business institute name'
          }
        }
      }
    }
  },
  CreateAnnouncementRequest: {
    type: 'object',
    required: ['heading', 'content', 'startDate', 'endDate', 'businessId'],
    properties: {
      heading: {
        type: 'string',
        minLength: 1,
        description: 'Title of the announcement (required)'
      },
      content: {
        type: 'string',
        minLength: 1,
        description: 'Description of the announcement (required)'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the announcement period (required)'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the announcement period (required)'
      },
      isActive: {
        type: 'boolean',
        default: true,
        description: 'Whether the announcement is active'
      },
      businessId: {
        type: 'integer',
        description: 'ID of the business this announcement belongs to (required)'
      },
      visibleToAdmins: {
        type: 'boolean',
        default: false,
        description: 'Whether the announcement is visible to admins'
      },
      visibleToTeachers: {
        type: 'boolean',
        default: false,
        description: 'Whether the announcement is visible to teachers'
      },
      visibleToStudents: {
        type: 'boolean',
        default: false,
        description: 'Whether the announcement is visible to students'
      }
    }
  },
  UpdateAnnouncementRequest: {
    type: 'object',
    properties: {
      heading: {
        type: 'string',
        minLength: 1,
        description: 'Title of the announcement'
      },
      content: {
        type: 'string',
        minLength: 1,
        description: 'Description of the announcement'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the announcement period'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the announcement period'
      },
      isActive: {
        type: 'boolean',
        description: 'Whether the announcement is active'
      },
      visibleToAdmins: {
        type: 'boolean',
        description: 'Whether the announcement is visible to admins'
      },
      visibleToTeachers: {
        type: 'boolean',
        description: 'Whether the announcement is visible to teachers'
      },
      visibleToStudents: {
        type: 'boolean',
        description: 'Whether the announcement is visible to students'
      }
    }
  },

  // Batch Schemas
  Batch: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Batch ID'
      },
      codeName: {
        type: 'string',
        description: 'Unique code name for the batch'
      },
      displayName: {
        type: 'string',
        description: 'Display name for the batch'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the batch'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the batch'
      },
      isActive: {
        type: 'boolean',
        description: 'Whether the batch is active'
      },
      courseId: {
        type: 'integer',
        description: 'ID of the course this batch belongs to'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Batch creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Batch last update timestamp'
      },
      course: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Course ID'
          },
          name: {
            type: 'string',
            description: 'Course name'
          }
        }
      }
    }
  },
  BatchWithUsers: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Batch ID'
      },
      codeName: {
        type: 'string',
        description: 'Unique code name for the batch'
      },
      displayName: {
        type: 'string',
        description: 'Display name for the batch'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the batch'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the batch'
      },
      isActive: {
        type: 'boolean',
        description: 'Whether the batch is active'
      },
      courseId: {
        type: 'integer',
        description: 'ID of the course this batch belongs to'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Batch creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Batch last update timestamp'
      },
      course: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Course ID'
          },
          name: {
            type: 'string',
            description: 'Course name'
          }
        }
      },
      batchUsers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Batch User ID'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the batch user is active'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Batch user creation timestamp'
            },
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'User ID'
                },
                email: {
                  type: 'string',
                  description: 'User email'
                },
                name: {
                  type: 'string',
                  description: 'User name'
                }
              }
            }
          }
        }
      }
    }
  },
  BatchUser: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Batch User ID'
      },
      userId: {
        type: 'integer',
        description: 'User ID'
      },
      batchId: {
        type: 'integer',
        description: 'Batch ID'
      },
      isActive: {
        type: 'boolean',
        description: 'Whether the batch user is active'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Batch user creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Batch user last update timestamp'
      },
      user: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'User ID'
          },
          email: {
            type: 'string',
            description: 'User email'
          },
          name: {
            type: 'string',
            description: 'User name'
          }
        }
      },
      batch: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Batch ID'
          },
          codeName: {
            type: 'string',
            description: 'Batch code name'
          },
          displayName: {
            type: 'string',
            description: 'Batch display name'
          },
          startDate: {
            type: 'string',
            format: 'date-time',
            description: 'Batch start date'
          },
          endDate: {
            type: 'string',
            format: 'date-time',
            description: 'Batch end date'
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the batch is active'
          },
          courseId: {
            type: 'integer',
            description: 'Course ID'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Batch creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Batch last update timestamp'
          }
        }
      }
    }
  },
  CreateBatchRequest: {
    type: 'object',
    required: ['codeName', 'displayName', 'startDate', 'endDate', 'courseId'],
    properties: {
      codeName: {
        type: 'string',
        minLength: 1,
        description: 'Unique code name for the batch (required)'
      },
      displayName: {
        type: 'string',
        minLength: 1,
        description: 'Display name for the batch (required)'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the batch (required)'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the batch (required)'
      },
      isActive: {
        type: 'boolean',
        default: true,
        description: 'Whether the batch is active'
      },
      courseId: {
        type: 'integer',
        description: 'ID of the course this batch belongs to (required)'
      }
    }
  },
  UpdateBatchRequest: {
    type: 'object',
    properties: {
      codeName: {
        type: 'string',
        minLength: 1,
        description: 'Unique code name for the batch'
      },
      displayName: {
        type: 'string',
        minLength: 1,
        description: 'Display name for the batch'
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date of the batch'
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date of the batch'
      },
      isActive: {
        type: 'boolean',
        description: 'Whether the batch is active'
      }
    }
  },
  AddUserToBatchRequest: {
    type: 'object',
    required: ['userId', 'batchId'],
    properties: {
      userId: {
        type: 'integer',
        description: 'User ID to add to batch (required)'
      },
      batchId: {
        type: 'integer',
        description: 'Batch ID to add user to (required)'
      }
    }
  },
  RemoveUserFromBatchRequest: {
    type: 'object',
    required: ['userId', 'batchId'],
    properties: {
      userId: {
        type: 'integer',
        description: 'User ID to remove from batch (required)'
      },
      batchId: {
        type: 'integer',
        description: 'Batch ID to remove user from (required)'
      }
    }
  },
  UpdateBatchUserRequest: {
    type: 'object',
    properties: {
      isActive: {
        type: 'boolean',
        description: 'Whether the batch user should be active'
      }
    }
  },

  // Content Schemas
  Content: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Content ID'
      },
      batchId: {
        type: 'integer',
        description: 'ID of the batch this content belongs to'
      },
      title: {
        type: 'string',
        description: 'Title of the content'
      },
      type: {
        type: 'string',
        enum: ['PDF', 'IMAGE', 'DOC'],
        description: 'Type of the content file'
      },
      filePath: {
        type: 'string',
        description: 'File path on the server'
      },
      fileSize: {
        type: 'integer',
        description: 'File size in bytes'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the content'
      },
      uploadedBy: {
        type: 'integer',
        description: 'ID of the user who uploaded the content'
      },
      updatedBy: {
        type: 'integer',
        description: 'ID of the user who last updated the content'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Content creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Content last update timestamp'
      },
      batch: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Batch ID'
          },
          codeName: {
            type: 'string',
            description: 'Batch code name'
          },
          displayName: {
            type: 'string',
            description: 'Batch display name'
          }
        }
      },
      uploader: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'User ID'
          },
          name: {
            type: 'string',
            description: 'User name'
          },
          email: {
            type: 'string',
            description: 'User email'
          }
        }
      },
      updater: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'User ID'
          },
          name: {
            type: 'string',
            description: 'User name'
          },
          email: {
            type: 'string',
            description: 'User email'
          }
        }
      }
    }
  },
  CreateContentRequest: {
    type: 'object',
    required: ['batchId', 'title', 'type', 'filePath', 'fileSize'],
    properties: {
      batchId: {
        type: 'integer',
        description: 'ID of the batch this content belongs to (required)'
      },
      title: {
        type: 'string',
        minLength: 1,
        description: 'Title of the content (required)'
      },
      type: {
        type: 'string',
        enum: ['PDF', 'IMAGE', 'DOC'],
        description: 'Type of the content file (required)'
      },
      filePath: {
        type: 'string',
        minLength: 1,
        description: 'File path on the server (required)'
      },
      fileSize: {
        type: 'integer',
        minimum: 1,
        description: 'File size in bytes (required)'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE',
        description: 'Status of the content'
      }
    }
  },
  UpdateContentRequest: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 1,
        description: 'Title of the content'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
        description: 'Status of the content'
      }
    }
  },
  ContentListResponse: {
    type: 'object',
    properties: {
      contents: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Content'
        },
        description: 'List of contents'
      },
      total: {
        type: 'integer',
        description: 'Total number of contents'
      },
      hasMore: {
        type: 'boolean',
        description: 'Whether there are more contents to fetch'
      }
    }
  },

  // Dashboard Schemas
  AdminDashboard: {
    type: 'object',
    properties: {
      stats: {
        type: 'object',
        properties: {
          totalUsers: {
            type: 'integer',
            description: 'Total number of active users'
          },
          totalTeachers: {
            type: 'integer',
            description: 'Total number of active teachers'
          },
          totalStudents: {
            type: 'integer',
            description: 'Total number of active students'
          },
          totalExams: {
            type: 'integer',
            description: 'Total number of exams'
          },
          totalCourses: {
            type: 'integer',
            description: 'Total number of courses'
          },
          totalBatches: {
            type: 'integer',
            description: 'Total number of batches'
          },
          totalContent: {
            type: 'integer',
            description: 'Total number of content items'
          },
          activeAnnouncements: {
            type: 'integer',
            description: 'Number of currently active announcements'
          }
        }
      },
      recentUsers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID'
            },
            name: {
              type: 'string',
              description: 'User name'
            },
            email: {
              type: 'string',
              description: 'User email'
            },
            role: {
              type: 'string',
              enum: ['ADMIN', 'TEACHER', 'STUDENT', 'USER'],
              description: 'User role'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp'
            }
          }
        },
        description: 'Recently created users'
      },
      recentAnnouncements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Announcement ID'
            },
            heading: {
              type: 'string',
              description: 'Announcement heading'
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Announcement start date'
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              description: 'Announcement end date'
            }
          }
        },
        description: 'Recent active announcements'
      }
    }
  },
  TeacherDashboard: {
    type: 'object',
    properties: {
      stats: {
        type: 'object',
        properties: {
          totalBatches: {
            type: 'integer',
            description: 'Total number of batches teacher is associated with'
          },
          totalStudents: {
            type: 'integer',
            description: 'Total number of students across all batches'
          },
          totalContent: {
            type: 'integer',
            description: 'Total content uploaded by teacher'
          },
          activeAnnouncements: {
            type: 'integer',
            description: 'Number of currently active announcements for teachers'
          }
        }
      },
      myBatches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Batch ID'
            },
            displayName: {
              type: 'string',
              description: 'Batch display name'
            },
            courseName: {
              type: 'string',
              description: 'Course name'
            },
            studentCount: {
              type: 'integer',
              description: 'Number of students in batch'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether batch is active'
            }
          }
        },
        description: 'Batches associated with teacher'
      },
      recentAnnouncements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Announcement ID'
            },
            heading: {
              type: 'string',
              description: 'Announcement heading'
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Announcement start date'
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              description: 'Announcement end date'
            }
          }
        },
        description: 'Recent active announcements for teachers'
      },
      recentContent: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Content ID'
            },
            title: {
              type: 'string',
              description: 'Content title'
            },
            batchName: {
              type: 'string',
              description: 'Batch name'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Content creation timestamp'
            }
          }
        },
        description: 'Recently uploaded content by teacher'
      }
    }
  },
  StudentDashboard: {
    type: 'object',
    properties: {
      stats: {
        type: 'object',
        properties: {
          enrolledBatches: {
            type: 'integer',
            description: 'Number of batches student is enrolled in'
          },
          totalContent: {
            type: 'integer',
            description: 'Total content available to student'
          },
          activeAnnouncements: {
            type: 'integer',
            description: 'Number of currently active announcements for students'
          }
        }
      },
      myBatches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Batch ID'
            },
            displayName: {
              type: 'string',
              description: 'Batch display name'
            },
            courseName: {
              type: 'string',
              description: 'Course name'
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Batch start date'
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              description: 'Batch end date'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether batch is active'
            }
          }
        },
        description: 'Batches student is enrolled in'
      },
      recentAnnouncements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Announcement ID'
            },
            heading: {
              type: 'string',
              description: 'Announcement heading'
            },
            content: {
              type: 'string',
              description: 'Announcement content'
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Announcement start date'
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              description: 'Announcement end date'
            }
          }
        },
        description: 'Recent active announcements for students'
      },
      recentContent: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Content ID'
            },
            title: {
              type: 'string',
              description: 'Content title'
            },
            batchName: {
              type: 'string',
              description: 'Batch name'
            },
            type: {
              type: 'string',
              enum: ['PDF', 'IMAGE', 'DOC'],
              description: 'Content type'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Content creation timestamp'
            }
          }
        },
        description: 'Recently added content available to student'
      }
    }
  },
  TestStatus: {
    type: 'integer',
    enum: [0, 1],
    description: '0=DRAFT, 1=PUBLISHED'
  },
  ResultVisibilityPractice: {
    type: 'integer',
    enum: [0, 1],
    description: '0=IMMEDIATE, 1=HIDDEN'
  },
  ResultVisibilityExam: {
    type: 'integer',
    enum: [0, 1],
    description: '0=AFTER_DEADLINE, 1=HIDDEN'
  },
  QuestionType: {
    type: 'integer',
    enum: [0, 1, 2, 3, 4],
    description: '0=SINGLE_CHOICE, 1=MULTIPLE_CHOICE, 2=TRUE_FALSE, 3=NUMERICAL, 4=FILL_IN_THE_BLANK'
  },
  AttemptStatus: {
    type: 'integer',
    enum: [0, 1, 2, 3],
    description: '0=IN_PROGRESS, 1=SUBMITTED, 2=AUTO_SUBMITTED, 3=EXPIRED'
  },
  LockedReason: {
    type: 'integer',
    enum: [0, 1, 2],
    description: '0=NOT_STARTED, 1=DEADLINE_PASSED, 2=ALREADY_ATTEMPTED'
  },
  PracticeTest: {
    type: 'object',
    required: [
      'id',
      'businessId',
      'batchId',
      'name',
      'status',
      'defaultMarksPerQuestion',
      'showExplanations',
      'shuffleQuestions',
      'shuffleOptions',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 50 },
      businessId: { type: 'string', minLength: 1, maxLength: 50 },
      batchId: { type: 'string', minLength: 1, maxLength: 50 },
      batchName: { type: 'string', description: 'Batch display name (when loaded with batch join)' },
      subjectId: { type: 'integer', minimum: 1, description: 'Subject ID (nullable during migration)' },
      subjectName: { type: 'string', description: 'Subject name (when loaded with subject join)' },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      status: { $ref: '#/components/schemas/TestStatus' },
      defaultMarksPerQuestion: { type: 'number', minimum: 0 },
      showExplanations: { type: 'boolean' },
      shuffleQuestions: { type: 'boolean' },
      shuffleOptions: { type: 'boolean' },
      totalQuestions: { type: 'integer', minimum: 0 },
      totalMarks: { type: 'number', minimum: 0 },
      createdBy: { type: 'string', minLength: 1, maxLength: 50 },
      updatedBy: { type: 'string', minLength: 1, maxLength: 50 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  },
  ExamTest: {
    type: 'object',
    required: [
      'id',
      'businessId',
      'batchId',
      'name',
      'startAt',
      'deadlineAt',
      'durationMinutes',
      'status',
      'createdBy',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 50 },
      businessId: { type: 'string', minLength: 1, maxLength: 50 },
      batchId: { type: 'string', minLength: 1, maxLength: 50 },
      batchName: { type: 'string', description: 'Batch display name (when loaded with batch join)' },
      subjectId: { type: 'integer', minimum: 1, description: 'Subject ID (nullable during migration)' },
      subjectName: { type: 'string', description: 'Subject name (when loaded with subject join)' },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      startAt: { type: 'string', format: 'date-time' },
      deadlineAt: { type: 'string', format: 'date-time' },
      durationMinutes: { type: 'integer', minimum: 1 },
      status: { $ref: '#/components/schemas/TestStatus' },
      defaultMarksPerQuestion: { type: 'number', minimum: 0 },
      negativeMarksPerQuestion: { type: 'number', minimum: 0 },
      resultVisibility: { $ref: '#/components/schemas/ResultVisibilityExam' },
      shuffleQuestions: { type: 'boolean' },
      shuffleOptions: { type: 'boolean' },
      totalQuestions: { type: 'integer', minimum: 0 },
      totalMarks: { type: 'number', minimum: 0 },
      createdBy: { type: 'string', minLength: 1, maxLength: 50 },
      updatedBy: { type: 'string', minLength: 1, maxLength: 50 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  },
  PracticeAvailableTest: {
    type: 'object',
    required: ['id', 'businessId', 'batchId', 'name', 'totalQuestions', 'totalMarks'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 50 },
      businessId: { type: 'string', minLength: 1, maxLength: 50 },
      batchId: { type: 'string', minLength: 1, maxLength: 50 },
      batchName: { type: 'string', description: 'Batch display name for UI' },
      subjectId: { type: 'integer', minimum: 1, description: 'Subject ID (nullable during migration)' },
      subjectName: { type: 'string', description: 'Subject name (when loaded with subject join)' },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      status: { $ref: '#/components/schemas/TestStatus' },
      totalQuestions: { type: 'integer', minimum: 0 },
      totalMarks: { type: 'number', minimum: 0 },
      defaultMarksPerQuestion: { type: 'number', minimum: 0 },
      canAttempt: { type: 'boolean' },
      attemptId: { type: 'string', minLength: 1, maxLength: 50 },
      attemptCount: { type: 'integer', minimum: 0 },
      bestScore: { type: 'number', minimum: 0 },
      lastAttemptAt: { type: 'string', format: 'date-time' }
    }
  },
  ExamAvailableTest: {
    type: 'object',
    required: ['id', 'businessId', 'batchId', 'name', 'startAt', 'deadlineAt', 'durationMinutes'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 50 },
      businessId: { type: 'string', minLength: 1, maxLength: 50 },
      batchId: { type: 'string', minLength: 1, maxLength: 50 },
      batchName: { type: 'string', description: 'Batch display name for UI' },
      subjectId: { type: 'integer', minimum: 1, description: 'Subject ID (nullable during migration)' },
      subjectName: { type: 'string', description: 'Subject name (when loaded with subject join)' },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      status: { $ref: '#/components/schemas/TestStatus' },
      startAt: { type: 'string', format: 'date-time' },
      deadlineAt: { type: 'string', format: 'date-time' },
      durationMinutes: { type: 'integer', minimum: 1 },
      totalQuestions: { type: 'integer', minimum: 0 },
      totalMarks: { type: 'number', minimum: 0 },
      defaultMarksPerQuestion: { type: 'number', minimum: 0 },
      negativeMarksPerQuestion: { type: 'number', minimum: 0 },
      resultVisibility: { $ref: '#/components/schemas/ResultVisibilityExam' },
      canAttempt: { type: 'boolean' },
      lockedReason: { $ref: '#/components/schemas/LockedReason' },
      attemptsAllowed: { type: 'integer', minimum: 1 },
      attemptsUsed: { type: 'integer', minimum: 0 },
      hasAttempt: { type: 'boolean' },
      attemptId: { type: 'string', minLength: 1, maxLength: 50 },
      lastAttemptAt: { type: 'string', format: 'date-time' }
    }
  },
  CreatePracticeTestDTO: {
    type: 'object',
    required: ['batchId', 'subjectId', 'name'],
    properties: {
      batchId: { type: 'string', minLength: 1, maxLength: 50 },
      subjectId: { type: 'integer', minimum: 1 },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      defaultMarksPerQuestion: { type: 'number', minimum: 0 },
      showExplanations: { type: 'boolean' },
      shuffleQuestions: { type: 'boolean' },
      shuffleOptions: { type: 'boolean' },
      status: { $ref: '#/components/schemas/TestStatus' }
    }
  },
  UpdatePracticeTestDTO: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      defaultMarksPerQuestion: { type: 'number', minimum: 0 },
      showExplanations: { type: 'boolean' },
      shuffleQuestions: { type: 'boolean' },
      shuffleOptions: { type: 'boolean' },
      status: { $ref: '#/components/schemas/TestStatus' }
    }
  },
  CreateExamTestDTO: {
    type: 'object',
    required: ['batchId', 'subjectId', 'name', 'startAt', 'deadlineAt', 'durationMinutes'],
    properties: {
      batchId: { type: 'string', minLength: 1, maxLength: 50 },
      subjectId: { type: 'integer', minimum: 1 },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      startAt: { type: 'string', format: 'date-time' },
      deadlineAt: { type: 'string', format: 'date-time' },
      durationMinutes: { type: 'integer', minimum: 1 },
      defaultMarksPerQuestion: { type: 'number', minimum: 0 },
      negativeMarksPerQuestion: { type: 'number', minimum: 0 },
      resultVisibility: { $ref: '#/components/schemas/ResultVisibilityExam' },
      shuffleQuestions: { type: 'boolean' },
      shuffleOptions: { type: 'boolean' },
      status: { $ref: '#/components/schemas/TestStatus' }
    }
  },
  UpdateExamTestDTO: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      startAt: { type: 'string', format: 'date-time' },
      deadlineAt: { type: 'string', format: 'date-time' },
      durationMinutes: { type: 'integer', minimum: 1 },
      defaultMarksPerQuestion: { type: 'number', minimum: 0 },
      negativeMarksPerQuestion: { type: 'number', minimum: 0 },
      resultVisibility: { $ref: '#/components/schemas/ResultVisibilityExam' },
      shuffleQuestions: { type: 'boolean' },
      shuffleOptions: { type: 'boolean' },
      subjectId: { type: 'integer', minimum: 1 },
      status: { $ref: '#/components/schemas/TestStatus' }
    }
  },
  PublishPracticeTestRequest: {
    type: 'object',
    required: ['practiceTestId'],
    properties: {
      practiceTestId: { type: 'string', minLength: 1, maxLength: 50 }
    }
  },
  PublishExamTestRequest: {
    type: 'object',
    required: ['examTestId'],
    properties: {
      examTestId: { type: 'string', minLength: 1, maxLength: 50 }
    }
  },
  CreateQuestionDTO: {
    type: 'object',
    required: ['type', 'questionText'],
    properties: {
      type: { $ref: '#/components/schemas/QuestionType' },
      questionText: { type: 'string', minLength: 1, maxLength: 4000 },
      text: {
        type: 'string',
        deprecated: true,
        description: 'Deprecated. Use questionText instead.',
        maxLength: 4000
      },
      mediaUrl: { type: 'string', maxLength: 2048, format: 'uri' },
      options: {
        type: 'array',
        items: { $ref: '#/components/schemas/TestOption' }
      },
      correctTextAnswer: { type: 'string', maxLength: 2000 },
      correctOptionIdsAnswers: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 50 }
      },
      correctOptionIds: {
        type: 'array',
        deprecated: true,
        description: 'Deprecated. Use correctOptionIdsAnswers instead.',
        items: { type: 'string', minLength: 1, maxLength: 50 }
      }
    }
  },
  UpdateQuestionDTO: {
    allOf: [{ $ref: '#/components/schemas/CreateQuestionDTO' }]
  },
  TestOption: {
    type: 'object',
    required: ['text'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 50 },
      text: { type: 'string', minLength: 1, maxLength: 1000 },
      mediaUrl: { type: 'string', maxLength: 2048, format: 'uri' },
      isCorrect: {
        type: 'boolean',
        deprecated: true,
        description: 'Deprecated. Correctness is defined on question via correctOptionIdsAnswers.'
      }
    }
  },
  TestQuestion: {
    type: 'object',
    required: ['id', 'type', 'questionText'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 50 },
      type: { $ref: '#/components/schemas/QuestionType' },
      questionText: { type: 'string', minLength: 1, maxLength: 4000 },
      text: {
        type: 'string',
        deprecated: true,
        description: 'Deprecated. Use questionText instead.',
        maxLength: 4000
      },
      mediaUrl: { type: 'string', maxLength: 2048, format: 'uri' },
      options: {
        type: 'array',
        items: { $ref: '#/components/schemas/TestOption' }
      }
    }
  },
  StartPracticeAttemptRequest: {
    type: 'object',
    required: ['practiceTestId'],
    properties: {
      practiceTestId: { type: 'string', minLength: 1, maxLength: 50 }
    }
  },
  StartExamAttemptRequest: {
    type: 'object',
    required: ['examTestId'],
    properties: {
      examTestId: { type: 'string', minLength: 1, maxLength: 50 }
    }
  },
  StartPrecticeTestAttemptResponse: {
    type: 'object',
    required: ['attemptId', 'test', 'questions', 'startedAt'],
    properties: {
      attemptId: { type: 'string', minLength: 1, maxLength: 50 },
      test: { $ref: '#/components/schemas/PracticeAvailableTest' },
      questions: {
        type: 'array',
        items: { $ref: '#/components/schemas/TestQuestion' }
      },
      startedAt: { type: 'string', format: 'date-time' }
    }
  },
  StartExamTestAttemptResponse: {
    type: 'object',
    required: ['attemptId', 'test', 'questions', 'startedAt'],
    properties: {
      attemptId: { type: 'string', minLength: 1, maxLength: 50 },
      test: { $ref: '#/components/schemas/ExamAvailableTest' },
      questions: {
        type: 'array',
        items: { $ref: '#/components/schemas/TestQuestion' }
      },
      startedAt: { type: 'string', format: 'date-time' }
    }
  },
  TestDetailsForAttempt: {
    type: 'object',
    required: ['id', 'name', 'totalQuestions', 'totalMarks'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 50 },
      businessId: { type: 'string', minLength: 1, maxLength: 50 },
      batchId: { type: 'string', minLength: 1, maxLength: 50 },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      type: { type: 'integer', enum: [0, 1], description: '0=Practice, 1=Exam' },
      status: { $ref: '#/components/schemas/TestStatus' },
      totalQuestions: { type: 'integer', minimum: 0 },
      totalMarks: { type: 'number', minimum: 0 },
      durationMinutes: { type: 'integer', minimum: 1 },
      defaultMarksPerQuestion: { type: 'number', minimum: 0 },
      negativeMarksPerQuestion: { type: 'number', minimum: 0 },
      showExplanations: { type: 'boolean' },
      shuffleQuestions: { type: 'boolean' },
      shuffleOptions: { type: 'boolean' },
      startAt: { type: 'string', format: 'date-time' },
      deadlineAt: { type: 'string', format: 'date-time' },
      resultVisibility: {
        oneOf: [
          { $ref: '#/components/schemas/ResultVisibilityPractice' },
          { $ref: '#/components/schemas/ResultVisibilityExam' }
        ],
        description: 'Practice=IMMEDIATE; Exam=AFTER_DEADLINE or HIDDEN.'
      },
      attemptsAllowed: { type: 'integer', minimum: 1 },
      attemptsUsed: { type: 'integer', minimum: 0 }
    }
  },
  SubmitAttemptRequest: {
    type: 'object',
    required: ['answers'],
    properties: {
      answers: {
        type: 'array',
        items: { $ref: '#/components/schemas/TestAnswerSubmission' }
      }
    }
  },
  TestAnswerSubmission: {
    type: 'object',
    required: ['questionId'],
    properties: {
      questionId: { type: 'string', minLength: 1, maxLength: 50 },
      selectedOptionIds: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 50 }
      },
      textAnswer: { type: 'string', maxLength: 2000 }
    }
  },
  SubmitAttemptResponse: {
    oneOf: [
      { $ref: '#/components/schemas/SubmitAttemptVisible' },
      { $ref: '#/components/schemas/SubmitAttemptHidden' }
    ]
  },
  SubmitAttemptVisible: {
    type: 'object',
    required: ['attemptId', 'status', 'score', 'totalScore', 'percentage'],
    properties: {
      attemptId: { type: 'string', minLength: 1, maxLength: 50 },
      status: { $ref: '#/components/schemas/AttemptStatus' },
      score: { type: 'number', minimum: 0 },
      totalScore: { type: 'number', minimum: 0 },
      percentage: { type: 'number', minimum: 0, maximum: 100 },
      answers: {
        type: 'array',
        items: { $ref: '#/components/schemas/TestAnswer' }
      },
      submittedAt: { type: 'string', format: 'date-time' },
      result: {
        type: 'object',
        nullable: true,
        description: 'Per-question evaluation detail (practice tests and visible exam results only)',
        properties: {
          questions: {
            type: 'array',
            items: { $ref: '#/components/schemas/SubmitAttemptResultQuestion' }
          }
        }
      }
    }
  },
  SubmitAttemptHidden: {
    type: 'object',
    required: ['attemptId', 'status', 'submittedAt'],
    properties: {
      attemptId: { type: 'string', minLength: 1, maxLength: 50 },
      status: { $ref: '#/components/schemas/AttemptStatus' },
      submittedAt: { type: 'string', format: 'date-time' }
    }
  },
  SubmitAttemptResultQuestion: {
    type: 'object',
    properties: {
      questionId: { type: 'string', minLength: 1, maxLength: 50 },
      isCorrect: { type: 'boolean', nullable: true },
      obtainedMarks: { type: 'number', nullable: true },
      correctOptionIds: { type: 'array', items: { type: 'string' } },
      correctTextAnswer: { type: 'string', nullable: true }
    }
  },
  StudentAttemptQuestion: {
    type: 'object',
    required: ['question'],
    description: 'Per-question row for student attempt detail: display + student answer + optional correct answer when policy allows.',
    properties: {
      question: { $ref: '#/components/schemas/TestQuestion' },
      studentAnswer: {
        type: 'object',
        nullable: true,
        description: 'Omitted or null when exam results are withheld before reveal.',
        properties: {
          selectedOptionIds: { type: 'array', items: { type: 'string' } },
          textAnswer: { type: 'string', nullable: true },
          isCorrect: { type: 'boolean', nullable: true },
          obtainedMarks: { type: 'number', nullable: true }
        }
      },
      correctAnswer: {
        type: 'object',
        nullable: true,
        description: 'Present only after practice submit or when exam result visibility allows.',
        properties: {
          correctOptionIds: { type: 'array', items: { type: 'string' } },
          correctTextAnswer: { type: 'string', nullable: true }
        }
      }
    }
  },
  TestAttemptDetails: {
    type: 'object',
    required: ['attempt', 'test', 'questions'],
    properties: {
      attempt: { $ref: '#/components/schemas/TestAttempt' },
      test: { $ref: '#/components/schemas/TestDetailsForAttempt' },
      questions: {
        type: 'array',
        items: { $ref: '#/components/schemas/TestQuestion' }
      },
      answers: {
        type: 'array',
        items: { $ref: '#/components/schemas/TestAnswer' }
      },
      summary: { $ref: '#/components/schemas/TestAttemptSummary' }
    }
  },
  PracticeTestAttemptDetails: {
    type: 'object',
    required: ['attempt', 'test', 'questions'],
    description:
      'Top-level `answers` removed; use `questions[].studentAnswer` and `questions[].correctAnswer`.',
    properties: {
      attempt: { $ref: '#/components/schemas/TestAttempt' },
      test: { $ref: '#/components/schemas/PracticeAvailableTest' },
      questions: {
        type: 'array',
        items: { $ref: '#/components/schemas/StudentAttemptQuestion' }
      }
    }
  },
  ExamTestAttemptDetails: {
    type: 'object',
    required: ['attempt', 'test', 'questions'],
    description:
      'Top-level `answers` removed; use `questions[].studentAnswer` and `questions[].correctAnswer` per result visibility.',
    properties: {
      attempt: { $ref: '#/components/schemas/TestAttempt' },
      test: { $ref: '#/components/schemas/ExamAvailableTest' },
      questions: {
        type: 'array',
        items: { $ref: '#/components/schemas/StudentAttemptQuestion' }
      }
    }
  },
  TestAttempt: {
    type: 'object',
    required: ['id', 'status', 'startedAt'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 50 },
      testId: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        deprecated: true,
        description: 'Deprecated. Use practiceTestId or examTestId.'
      },
      practiceTestId: { type: 'string', minLength: 1, maxLength: 50 },
      examTestId: { type: 'string', minLength: 1, maxLength: 50 },
      userId: { type: 'string', minLength: 1, maxLength: 50 },
      status: { $ref: '#/components/schemas/AttemptStatus' },
      startedAt: { type: 'string', format: 'date-time' },
      submittedAt: { type: 'string', format: 'date-time' },
      score: { type: 'number', minimum: 0 },
      totalScore: { type: 'number', minimum: 0 },
      percentage: { type: 'number', minimum: 0, maximum: 100 }
    }
  },
  TestAttemptSummary: {
    type: 'object',
    properties: {
      correctCount: { type: 'integer', minimum: 0 },
      incorrectCount: { type: 'integer', minimum: 0 },
      skippedCount: { type: 'integer', minimum: 0 },
      timeTakenSeconds: { type: 'integer', minimum: 0 }
    }
  },
  TestAnswer: {
    type: 'object',
    properties: {
      questionId: { type: 'string', minLength: 1, maxLength: 50 },
      selectedOptionIds: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 50 }
      },
      textAnswer: { type: 'string', maxLength: 2000 },
      isCorrect: { type: 'boolean' },
      obtainedMarks: { type: 'number', minimum: 0 }
    }
  },
  TestAnalytics: {
    type: 'object',
    properties: {
      totalAttempts: { type: 'integer', minimum: 0 },
      averageScore: { type: 'number', minimum: 0 },
      averagePercentage: { type: 'number', minimum: 0, maximum: 100 },
      passRate: { type: 'number', minimum: 0, maximum: 100 },
      highestScore: { type: 'number', minimum: 0 },
      lowestScore: { type: 'number', minimum: 0 },
      attempts: {
        type: 'array',
        items: { $ref: '#/components/schemas/TestAnalyticsAttempt' }
      },
      questionStats: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            questionId: { type: 'string', minLength: 1, maxLength: 50 },
            correctCount: { type: 'integer', minimum: 0 },
            totalAttempts: { type: 'integer', minimum: 0 },
            accuracy: { type: 'number', minimum: 0, maximum: 100 }
          }
        }
      }
    }
  },
  TestAnalyticsAttempt: {
    type: 'object',
    required: ['attemptId', 'userId', 'status', 'startedAt'],
    properties: {
      attemptId: { type: 'string', minLength: 1, maxLength: 50 },
      userId: { type: 'string', minLength: 1, maxLength: 50 },
      status: { $ref: '#/components/schemas/AttemptStatus' },
      startedAt: { type: 'string', format: 'date-time' },
      submittedAt: { type: 'string', format: 'date-time' },
      score: { type: 'number', minimum: 0 },
      totalScore: { type: 'number', minimum: 0 },
      percentage: { type: 'number', minimum: 0, maximum: 100 }
    }
  }
};

export const swaggerParameters = {
  businessId: {
    name: 'businessId',
    in: 'path',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 50 }
  },
  practiceTestId: {
    name: 'practiceTestId',
    in: 'path',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 50 },
    description: 'Deprecated in favor of request body for publish/attempt start.'
  },
  examTestId: {
    name: 'examTestId',
    in: 'path',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 50 },
    description: 'Deprecated in favor of request body for publish/attempt start.'
  },
  questionId: {
    name: 'questionId',
    in: 'path',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 50 }
  },
  attemptId: {
    name: 'attemptId',
    in: 'path',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 50 }
  }
};

export const swaggerResponses = {
  ApiResponse: {
    description: 'Standard API response',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ApiResponse' }
      }
    }
  },
  BadRequest: {
    description: 'Bad request',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' }
      }
    }
  },
  Unauthorized: {
    description: 'Unauthorized',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' }
      }
    }
  },
  Forbidden: {
    description: 'Forbidden',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' }
      }
    }
  },
  NotFound: {
    description: 'Not found',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' }
      }
    }
  },
  Conflict: {
    description: 'Conflict',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' }
      }
    }
  },
  UnprocessableEntity: {
    description: 'Validation error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' }
      }
    }
  },
  InternalServerError: {
    description: 'Internal server error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' }
      }
    }
  }
};
