import { PrismaClient, UserRole, UserStatus, CourseStatus, SubjectStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create a business
  const business = await prisma.business.create({
    data: {
      instituteName: 'ContentKosh Academy',
      tagline: 'Your Gateway to Success',
      contactNumber: '+91-9876543210',
      email: 'info@contentkosh.com',
      address: '123 Education Street, Learning City, LC 12345',
      youtubeUrl: 'https://youtube.com/@contentkosh',
      instagramUrl: 'https://instagram.com/contentkosh',
      linkedinUrl: 'https://linkedin.com/company/contentkosh',
      facebookUrl: 'https://facebook.com/contentkosh',
    },
  });
  console.log('✅ Created business:', business.instituteName);

  // Hash password for all users
  const hashedPassword = await bcrypt.hash('Password#123', 10);

  // Create users with direct business and role assignment
  const users = await Promise.all([
    // SUPERADMIN
    prisma.user.create({
      data: {
        email: 'superadmin@contentkosh.com',
        password: hashedPassword,
        name: 'Super Admin',
        businessId: business.id,
        role: UserRole.SUPERADMIN,
        status: UserStatus.ACTIVE,
      },
    }),
    // ADMIN
    prisma.user.create({
      data: {
        email: 'admin@contentkosh.com',
        password: hashedPassword,
        name: 'Admin User',
        businessId: business.id,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    }),
    // TEACHER
    prisma.user.create({
      data: {
        email: 'teacher@contentkosh.com',
        password: hashedPassword,
        name: 'John Teacher',
        businessId: business.id,
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
      },
    }),
    // STUDENT
    prisma.user.create({
      data: {
        email: 'student@contentkosh.com',
        password: hashedPassword,
        name: 'Jane Student',
        businessId: business.id,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      },
    }),
    // USER (general user role)
    prisma.user.create({
      data: {
        email: 'user@contentkosh.com',
        password: hashedPassword,
        name: 'Regular User',
        businessId: business.id,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    }),
  ]);

  console.log('✅ Created users:', users.map(u => `${u.name} (${u.email}) - ${u.role}`));

  // Create exams
  const exams = await Promise.all([
    prisma.exam.create({
      data: {
        name: 'UPSC Civil Services',
        code: 'UPSC-CS',
        description: 'Union Public Service Commission Civil Services Examination',
        status: 'ACTIVE',
        businessId: business.id,
        createdBy: users[0].id,
      },
    }),
    prisma.exam.create({
      data: {
        name: 'NEET',
        code: 'NEET-UG',
        description: 'National Eligibility cum Entrance Test for Medical Courses',
        status: 'ACTIVE',
        businessId: business.id,
        createdBy: users[0].id,
      },
    }),
    prisma.exam.create({
      data: {
        name: 'JEE Main',
        code: 'JEE-MAIN',
        description: 'Joint Entrance Examination for Engineering',
        status: 'ACTIVE',
        businessId: business.id,
        createdBy: users[0].id,
      },
    }),
  ]);

  console.log('✅ Created exams:', exams.map(e => e.name));

  // Create courses for each exam
  const courses = await Promise.all([
    // UPSC Courses
    prisma.course.create({
      data: {
        name: 'UPSC Prelims + Mains',
        description: 'Complete preparation for UPSC Prelims and Mains',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        status: CourseStatus.ACTIVE,
        examId: exams[0].id,
      },
    }),
    prisma.course.create({
      data: {
        name: 'UPSC Optional Subject - Geography',
        description: 'Geography optional subject preparation',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-08-31'),
        status: CourseStatus.ACTIVE,
        examId: exams[0].id,
      },
    }),
    // NEET Courses
    prisma.course.create({
      data: {
        name: 'NEET Complete Course',
        description: 'Complete NEET preparation with all subjects',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-06-30'),
        status: CourseStatus.ACTIVE,
        examId: exams[1].id,
      },
    }),
    prisma.course.create({
      data: {
        name: 'NEET Crash Course',
        description: 'Intensive NEET preparation for last 6 months',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-30'),
        status: CourseStatus.ACTIVE,
        examId: exams[1].id,
      },
    }),
    // JEE Courses
    prisma.course.create({
      data: {
        name: 'JEE Main + Advanced',
        description: 'Complete JEE preparation for both Main and Advanced',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        status: CourseStatus.ACTIVE,
        examId: exams[2].id,
      },
    }),
  ]);

  console.log('✅ Created courses:', courses.map(c => c.name));

  // Create subjects for each course
  const subjects = await Promise.all([
    // UPSC Prelims + Mains subjects
    prisma.subject.create({
      data: {
        name: 'History',
        description: 'Indian History and World History',
        status: SubjectStatus.ACTIVE,
        courseId: courses[0].id,
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Geography',
        description: 'Physical and Human Geography',
        status: SubjectStatus.ACTIVE,
        courseId: courses[0].id,
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Polity',
        description: 'Indian Constitution and Political System',
        status: SubjectStatus.ACTIVE,
        courseId: courses[0].id,
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Economics',
        description: 'Indian Economy and Economic Concepts',
        status: SubjectStatus.ACTIVE,
        courseId: courses[0].id,
      },
    }),
    // NEET subjects
    prisma.subject.create({
      data: {
        name: 'Physics',
        description: 'Physics for NEET',
        status: SubjectStatus.ACTIVE,
        courseId: courses[2].id,
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Chemistry',
        description: 'Chemistry for NEET',
        status: SubjectStatus.ACTIVE,
        courseId: courses[2].id,
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Biology',
        description: 'Biology for NEET',
        status: SubjectStatus.ACTIVE,
        courseId: courses[2].id,
      },
    }),
    // JEE subjects
    prisma.subject.create({
      data: {
        name: 'Mathematics',
        description: 'Mathematics for JEE',
        status: SubjectStatus.ACTIVE,
        courseId: courses[4].id,
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Physics',
        description: 'Physics for JEE',
        status: SubjectStatus.ACTIVE,
        courseId: courses[4].id,
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Chemistry',
        description: 'Chemistry for JEE',
        status: SubjectStatus.ACTIVE,
        courseId: courses[4].id,
      },
    }),
  ]);

  console.log('✅ Created subjects:', subjects.map(s => s.name));

  // Create batches
  const batches = await Promise.all([
    prisma.batch.create({
      data: {
        codeName: 'UPSC2024A',
        displayName: 'UPSC 2024 Batch A',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
        courseId: courses[0].id,
      },
    }),
    prisma.batch.create({
      data: {
        codeName: 'NEET2024A',
        displayName: 'NEET 2024 Batch A',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
        courseId: courses[2].id,
      },
    }),
    prisma.batch.create({
      data: {
        codeName: 'JEE2024A',
        displayName: 'JEE 2024 Batch A',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
        courseId: courses[4].id,
      },
    }),
  ]);

  console.log('✅ Created batches:', batches.map(b => b.displayName));

  // Assign teacher and student to batches
  const batchUsers = await Promise.all([
    // Teacher assigned to UPSC batch
    prisma.batchUser.create({
      data: {
        userId: users[2].id, // TEACHER
        batchId: batches[0].id, // UPSC batch
        isActive: true,
      },
    }),
    // Student assigned to UPSC batch
    prisma.batchUser.create({
      data: {
        userId: users[3].id, // STUDENT
        batchId: batches[0].id, // UPSC batch
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Created batch user assignments');

  // Create announcements
  const announcements = await Promise.all([
    prisma.announcement.create({
      data: {
        heading: 'Welcome to ContentKosh Academy!',
        content: 'We are excited to have you join our learning community. Please check your course materials and schedule.',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
        businessId: business.id,
        visibleToAdmins: true,
        visibleToTeachers: true,
        visibleToStudents: true,
      },
    }),
    prisma.announcement.create({
      data: {
        heading: 'UPSC Prelims Exam Date Announced',
        content: 'The UPSC Prelims examination is scheduled for June 16, 2024. Please prepare accordingly.',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-16'),
        isActive: true,
        businessId: business.id,
        visibleToAdmins: true,
        visibleToTeachers: true,
        visibleToStudents: true,
      },
    }),
    prisma.announcement.create({
      data: {
        heading: 'Teacher Training Session',
        content: 'All teachers are required to attend the training session on teaching methodologies.',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
        businessId: business.id,
        visibleToAdmins: true,
        visibleToTeachers: true,
        visibleToStudents: false,
      },
    }),
  ]);

  console.log('✅ Created announcements:', announcements.map(a => a.heading));

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- 1 Business: ${business.instituteName}`);
  console.log(`- ${users.length} Users (SUPERADMIN, ADMIN, TEACHER, STUDENT, USER)`);
  console.log(`- ${exams.length} Exams`);
  console.log(`- ${courses.length} Courses`);
  console.log(`- ${subjects.length} Subjects`);
  console.log(`- ${batches.length} Batches`);
  console.log(`- ${batchUsers.length} Batch User Assignments`);
  console.log(`- ${announcements.length} Announcements`);

  console.log('\n🔑 Test Credentials (Password: Password#123):');
  console.log('- Super Admin: superadmin@contentkosh.com');
  console.log('- Admin: admin@contentkosh.com');
  console.log('- Teacher: teacher@contentkosh.com');
  console.log('- Student: student@contentkosh.com');
  console.log('- User: user@contentkosh.com');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
