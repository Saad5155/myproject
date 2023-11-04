
from django.shortcuts import render, redirect
from myapp.models import Student, Course

def student_list(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        # Save the student data
        student = Student.objects.create(name=name)
        return redirect('student_list')
    else:
        students = Student.objects.all()
        return render(request, 'student_list.html', {'students': students})

def course_list(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        # Save the course data
        course = Course.objects.create(name=name)
        return redirect('course_list')
    else:
        courses = Course.objects.all()
        return render(request, 'course_list.html', {'courses': courses})

def student_details(request, pk):
    student = Student.objects.get(pk=pk)
    if request.method == 'POST':
        course_id = request.POST.get('course')
        course = Course.objects.get(pk=course_id)
        student.courses.add(course)
        return redirect('student_details', pk=pk)
    else:
        available_courses = Course.objects.exclude(student__in=[student])
        return render(request, 'student_details.html', {'student': student, 'available_courses': available_courses})
