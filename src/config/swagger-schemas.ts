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
  }
};
