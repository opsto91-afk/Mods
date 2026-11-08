CXX ?= g++
patch_test: patch_test.cpp ../src/WaterPatch.cpp ../src/WaterPatch.hpp
	$(CXX) -std=c++20 -Wall -Wextra -I../src patch_test.cpp ../src/WaterPatch.cpp -o patch_test
run: patch_test
	./patch_test
